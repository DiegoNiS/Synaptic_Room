// ============================================
// Synaptic Room — Mentorship Use Case
// ============================================
// Handles the lifecycle of micro-mentorships:
//   - Finding the best mentor for a blocked student
//   - Creating the mentorship and notifying both parties
//   - Closing mentorships (manual, resolved, expired)
//   - Auto-expiration of stale mentorships
// ============================================

import { Mentorship } from '../domain/models/Mentorship.js';
import { createComponentLogger } from '../utils/logger.js';

const log = createComponentLogger('mentorship');

export class MentorshipUseCase {
  /**
   * @param {Object} deps
   * @param {Map<string, import('../domain/models/Session.js').Session>} deps.activeSessions
   * @param {Map<string, Mentorship>} deps.activeMentorships
   * @param {import('../infrastructure/db/SessionRepository.js').SessionRepository} deps.sessionRepository
   * @param {import('../infrastructure/ai/AgentClient.js').AgentClient} deps.agentClient
   * @param {import('socket.io').Server} deps.io
   */
  constructor({ activeSessions, activeMentorships, sessionRepository, agentClient, io }) {
    this.activeSessions = activeSessions;
    this.activeMentorships = activeMentorships;
    this.sessionRepository = sessionRepository;
    this.agentClient = agentClient;
    this.io = io;

    // Start the expiration checker (runs every 30 seconds)
    this._expirationInterval = setInterval(() => this._checkExpirations(), 30_000);
  }

  /**
   * Attempts to match a blocked student with the best available mentor.
   *
   * @param {string} sessionId
   * @param {string} blockedStudentId
   * @returns {Promise<Mentorship|null>}
   */
  async attemptMatch(sessionId, blockedStudentId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const blockedStudent = session.getStudent(blockedStudentId);
    if (!blockedStudent || !blockedStudent.needsMentor()) {
      log.debug({ blockedStudentId }, 'Student no longer needs mentor');
      return null;
    }

    // Find all potential mentors in flow — build ENRICHED profiles
    const availableMentorProfiles = Array.from(session.students.values())
      .filter((s) => s.studentId !== blockedStudentId && s.isAvailableAsMentor())
      .map((s) => ({
        id: s.studentId,
        displayName: s.displayName,
        confidence: s.confidence,
        timeInFlowMs: s.timeInCurrentState(),
        currentChallenge: null, // Could be enriched from session exercise data
      }));

    if (availableMentorProfiles.length === 0) {
      log.info({ sessionId, blockedStudentId }, 'No available mentors in flow');
      return null;
    }

    let mentorId = null;
    if (this.agentClient) {
      try {
        const matchResult = await this.agentClient.matchMentor({
          blockedStudentId,
          sessionId,
          blockagePoint: blockedStudent.blockagePoint || null,
          availableMentors: availableMentorProfiles,
        });
        if (matchResult && matchResult.mentorId && matchResult.mentorId !== 'none') {
          mentorId = matchResult.mentorId;
          log.info({ blockedStudentId, mentorId, matchScore: matchResult.matchScore }, 'AI match found via Cognitive Mesh');
        }
      } catch (error) {
        log.warn({ err: error, blockedStudentId }, 'AI mentor matching failed, falling back to heuristic');
      }
    }

    // Fallback to basic heuristic if AI fails or returns none
    if (!mentorId) {
      const fallbackMentor = session.findBestMentor(blockedStudentId);
      if (fallbackMentor) {
        mentorId = fallbackMentor.studentId;
        log.info({ blockedStudentId, mentorId }, 'Fallback to basic heuristic mentor matching');
      }
    }

    if (!mentorId) {
      log.info(
        { sessionId, blockedStudentId },
        'No available mentor found — student will be retried on next analysis'
      );
      return null;
    }

    const mentor = session.getStudent(mentorId);
    if (!mentor) {
      log.error({ mentorId, sessionId }, 'Mentor student object not found in session');
      return null;
    }

    // Create the mentorship
    const mentorship = Mentorship.create({
      sessionId,
      mentor,
      mentee: blockedStudent,
      topic: blockedStudent.blockagePoint,
    });

    // Update domain models
    const updatedMentor = mentor.withMentorship(mentorship.mentorshipId);
    const updatedMentee = blockedStudent.withMentorship(mentorship.mentorshipId);
    session.updateStudent(updatedMentor);
    session.updateStudent(updatedMentee);

    // Store the active mentorship
    this.activeMentorships.set(mentorship.mentorshipId, mentorship);

    // Notify both students via Socket.io
    this.io.to(sessionId).emit('mentorship:start', mentorship.toStartPayload());

    // Update the teacher's node map
    this.io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());

    log.info(
      {
        mentorshipId: mentorship.mentorshipId,
        mentorId: mentor.studentId,
        menteeId: blockedStudentId,
        topic: mentorship.topic,
      },
      'Micro-mentorship created'
    );

    // Persist mentorship record to Supabase (fire-and-forget)
    this.sessionRepository.saveMentorship(mentorship);
    this.sessionRepository.logEvent({
      sessionId,
      studentId: blockedStudentId,
      eventType: 'mentorship_start',
      metadata: {
        mentorshipId: mentorship.mentorshipId,
        mentorId: mentor.studentId,
        topic: mentorship.topic,
      },
    });

    return mentorship;
  }

  /**
   * Closes an active mentorship.
   *
   * @param {string} mentorshipId
   * @param {string} closedBy - studentId of who closed it
   * @param {'resolved' | 'timeout' | 'manual'} reason
   */
  async closeMentorship(mentorshipId, closedBy, reason) {
    const mentorship = this.activeMentorships.get(mentorshipId);
    if (!mentorship) {
      log.warn({ mentorshipId }, 'Mentorship not found for close');
      return;
    }

    const closedMentorship = mentorship.close(reason);
    this.activeMentorships.delete(mentorshipId);

    // Clear mentorship state from both students
    const session = this.activeSessions.get(mentorship.sessionId);
    if (session) {
      const mentor = session.getStudent(mentorship.mentorId);
      const mentee = session.getStudent(mentorship.menteeId);

      // Restore the mentor toward their prior 'flow' so they re-enter the
      // mentor pool; reset the mentee to a clean idle for a fresh start.
      const clearedMentor = mentor ? mentor.withMentorshipCleared({ restore: true }) : null;
      const clearedMentee = mentee ? mentee.withMentorshipCleared({ restore: false }) : null;
      if (clearedMentor) session.updateStudent(clearedMentor);
      if (clearedMentee) session.updateStudent(clearedMentee);

      // Notify the room the mentorship ended
      this.io.to(mentorship.sessionId).emit('mentorship:ended', {
        mentorshipId,
        reason,
        closedBy,
      });

      // Emit AUTHORITATIVE cognitive:state for both, so a client that missed
      // the optimistic local revert (e.g. after reconnect) is corrected.
      for (const s of [clearedMentor, clearedMentee]) {
        if (!s) continue;
        this.io.to(mentorship.sessionId).emit('cognitive:state', {
          studentId: s.studentId,
          state: s.state,
          confidence: s.confidence,
          blockagePoint: s.blockagePoint,
        });
      }

      // Update teacher dashboard
      this.io.to(`teacher:${mentorship.sessionId}`).emit(
        'session:nodeMap',
        session.toNodeMap()
      );
    }

    log.info({ mentorshipId, reason, closedBy }, 'Mentorship closed');

    // Update mentorship record in Supabase and log the event (fire-and-forget)
    const durationMs = Date.now() - mentorship.createdAt;
    this.sessionRepository.closeMentorship(mentorshipId, closedMentorship.status, durationMs);
    this.sessionRepository.logEvent({
      sessionId: mentorship.sessionId,
      studentId: closedBy,
      eventType: 'mentorship_end',
      metadata: { mentorshipId, reason, status: closedMentorship.status, durationMs },
    });
  }

  /**
   * Looks up an active mentorship by id.
   * @param {string} mentorshipId
   * @returns {Mentorship|undefined}
   */
  getMentorship(mentorshipId) {
    return this.activeMentorships.get(mentorshipId);
  }

  /**
   * Finds the active mentorship a student currently participates in.
   * Used to resync a reconnecting client.
   * @param {string} studentId
   * @param {string} [sessionId]
   * @returns {Mentorship|null}
   */
  getActiveMentorshipForStudent(studentId, sessionId) {
    for (const m of this.activeMentorships.values()) {
      if (sessionId && m.sessionId !== sessionId) continue;
      if (m.mentorId === studentId || m.menteeId === studentId) return m;
    }
    return null;
  }

  /**
   * Periodically checks for and closes expired mentorships.
   * @private
   */
  _checkExpirations() {
    // Snapshot expired ids first — closeMentorship mutates activeMentorships.
    const expiredIds = [];
    for (const [id, mentorship] of this.activeMentorships) {
      if (mentorship.isExpired()) expiredIds.push(id);
    }
    for (const id of expiredIds) {
      log.info({ mentorshipId: id }, 'Mentorship expired — auto-closing');
      this.closeMentorship(id, 'system', 'timeout');
    }
  }

  /**
   * Cleanup on server shutdown.
   */
  destroy() {
    if (this._expirationInterval) {
      clearInterval(this._expirationInterval);
    }
  }
}
