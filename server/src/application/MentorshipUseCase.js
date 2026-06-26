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
   * @param {import('socket.io').Server} deps.io
   */
  constructor({ activeSessions, activeMentorships, sessionRepository, io }) {
    this.activeSessions = activeSessions;
    this.activeMentorships = activeMentorships;
    this.sessionRepository = sessionRepository;
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

    // Find the best available mentor in the same session
    const mentor = session.findBestMentor(blockedStudentId);
    if (!mentor) {
      log.info(
        { sessionId, blockedStudentId },
        'No available mentor found — student will be retried on next analysis'
      );
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

      if (mentor) session.updateStudent(mentor.withMentorshipCleared());
      if (mentee) session.updateStudent(mentee.withMentorshipCleared());

      // Notify the room
      this.io.to(mentorship.sessionId).emit('mentorship:ended', {
        mentorshipId,
        reason,
        closedBy,
      });

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
   * Periodically checks for and closes expired mentorships.
   * @private
   */
  _checkExpirations() {
    for (const [id, mentorship] of this.activeMentorships) {
      if (mentorship.isExpired()) {
        log.info({ mentorshipId: id }, 'Mentorship expired — auto-closing');
        this.closeMentorship(id, 'system', 'timeout');
      }
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
