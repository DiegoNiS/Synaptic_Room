// ============================================
// Synaptic Room — MentorshipUseCase Unit Tests
// ============================================
// Uses Node.js native test runner (node:test)
// and assertion library (node:assert).
//
// Run with: npm test
// Or directly: node --test tests/MentorshipUseCase.test.js
// ============================================

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Domain Models (real — they're pure, no I/O) ──
import { Student } from '../src/domain/models/Student.js';
import { Session } from '../src/domain/models/Session.js';

// ── The unit under test ──
import { MentorshipUseCase } from '../src/application/MentorshipUseCase.js';

// ============================================
// TEST HELPERS — Mocks & Factories
// ============================================

/**
 * Creates a mock SessionRepository that records calls.
 * Every method is a no-op that logs its arguments.
 */
function createMockRepository() {
  const calls = {
    saveMentorship: [],
    closeMentorship: [],
    logEvent: [],
  };

  return {
    calls,
    saveMentorship(mentorship) {
      calls.saveMentorship.push(mentorship);
    },
    closeMentorship(id, status, durationMs) {
      calls.closeMentorship.push({ id, status, durationMs });
    },
    logEvent(event) {
      calls.logEvent.push(event);
    },
  };
}

/**
 * Creates a mock Socket.io server that records emitted events.
 */
function createMockIO() {
  const emitted = [];

  return {
    emitted,
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };
}

/**
 * Creates a student in 'flow' state (available as mentor).
 */
function createFlowStudent(id, sessionId, name = 'Mentor') {
  return new Student({
    studentId: id,
    sessionId,
    displayName: name,
    state: 'flow',
    confidence: 0.9,
  });
}

/**
 * Creates a student in 'blocked' state (needs mentor).
 */
function createBlockedStudent(id, sessionId, name = 'Mentee') {
  return new Student({
    studentId: id,
    sessionId,
    displayName: name,
    state: 'blocked',
    confidence: 0.8,
    blockagePoint: 'No entiende recursión',
  });
}

// ============================================
// TESTS
// ============================================

describe('MentorshipUseCase', () => {
  const SESSION_ID = 'test-session-001';
  let activeSessions;
  let activeMentorships;
  let mockRepo;
  let mockIO;
  let useCase;

  beforeEach(() => {
    activeSessions = new Map();
    activeMentorships = new Map();
    mockRepo = createMockRepository();
    mockIO = createMockIO();

    useCase = new MentorshipUseCase({
      activeSessions,
      activeMentorships,
      sessionRepository: mockRepo,
      io: mockIO,
    });
  });

  afterEach(() => {
    // Stop the expiration timer to prevent leaking into other tests
    useCase.destroy();
  });

  // ── attemptMatch ──

  describe('attemptMatch()', () => {
    it('should return null if the session does not exist', async () => {
      const result = await useCase.attemptMatch('non-existent', 'student-1');
      assert.strictEqual(result, null);
    });

    it('should return null if the blocked student is not in the session', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      activeSessions.set(SESSION_ID, session);

      const result = await useCase.attemptMatch(SESSION_ID, 'ghost-student');
      assert.strictEqual(result, null);
    });

    it('should return null if no mentor is available', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      const blocked = createBlockedStudent('s-blocked', SESSION_ID);
      session.addStudent(blocked);
      activeSessions.set(SESSION_ID, session);

      const result = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      assert.strictEqual(result, null);
    });

    it('should create a mentorship when a mentor is available', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      const blocked = createBlockedStudent('s-blocked', SESSION_ID, 'Ana');
      const mentor = createFlowStudent('s-mentor', SESSION_ID, 'Carlos');
      session.addStudent(blocked);
      session.addStudent(mentor);
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');

      // ── Mentorship was created ──
      assert.ok(mentorship, 'Mentorship should not be null');
      assert.strictEqual(mentorship.mentorId, 's-mentor');
      assert.strictEqual(mentorship.menteeId, 's-blocked');
      assert.strictEqual(mentorship.mentorName, 'Carlos');
      assert.strictEqual(mentorship.menteeName, 'Ana');
      assert.strictEqual(mentorship.status, 'active');
    });

    it('should store the mentorship in activeMentorships', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');

      assert.strictEqual(activeMentorships.size, 1);
      assert.strictEqual(activeMentorships.get(mentorship.mentorshipId), mentorship);
    });

    it('should update both students to mentoring state', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');

      const updatedMentor = session.getStudent('s-mentor');
      const updatedMentee = session.getStudent('s-blocked');

      assert.strictEqual(updatedMentor.state, 'mentoring');
      assert.strictEqual(updatedMentor.activeMentorshipId, mentorship.mentorshipId);
      assert.strictEqual(updatedMentee.state, 'mentoring');
      assert.strictEqual(updatedMentee.activeMentorshipId, mentorship.mentorshipId);
    });

    it('should emit mentorship:start and session:nodeMap via Socket.io', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      await useCase.attemptMatch(SESSION_ID, 's-blocked');

      // Should emit to the session room
      const startEvent = mockIO.emitted.find(
        (e) => e.event === 'mentorship:start' && e.room === SESSION_ID
      );
      assert.ok(startEvent, 'mentorship:start should be emitted to session room');
      assert.strictEqual(startEvent.payload.mentor.studentId, 's-mentor');
      assert.strictEqual(startEvent.payload.mentee.studentId, 's-blocked');

      // Should emit nodeMap update to teacher room
      const nodeMapEvent = mockIO.emitted.find(
        (e) => e.event === 'session:nodeMap' && e.room === `teacher:${SESSION_ID}`
      );
      assert.ok(nodeMapEvent, 'session:nodeMap should be emitted to teacher room');
    });

    it('should persist mentorship and log event to the repository', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      await useCase.attemptMatch(SESSION_ID, 's-blocked');

      // saveMentorship was called
      assert.strictEqual(mockRepo.calls.saveMentorship.length, 1);
      assert.strictEqual(mockRepo.calls.saveMentorship[0].mentorId, 's-mentor');

      // logEvent was called with 'mentorship_start'
      assert.strictEqual(mockRepo.calls.logEvent.length, 1);
      assert.strictEqual(mockRepo.calls.logEvent[0].eventType, 'mentorship_start');
      assert.strictEqual(mockRepo.calls.logEvent[0].studentId, 's-blocked');
    });

    it('should NOT match a student who is already mentoring', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      const blocked = createBlockedStudent('s-blocked', SESSION_ID);

      // Mentor already in a mentorship
      const busyMentor = new Student({
        studentId: 's-mentor',
        sessionId: SESSION_ID,
        displayName: 'Busy',
        state: 'flow',
        confidence: 0.9,
        activeMentorshipId: 'existing-mentorship',
      });

      session.addStudent(blocked);
      session.addStudent(busyMentor);
      activeSessions.set(SESSION_ID, session);

      const result = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      assert.strictEqual(result, null, 'Should not match a busy mentor');
    });
  });

  // ── closeMentorship ──

  describe('closeMentorship()', () => {
    it('should remove the mentorship from activeMentorships', async () => {
      // Setup: create a mentorship first
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      assert.strictEqual(activeMentorships.size, 1);

      // Close it
      await useCase.closeMentorship(mentorship.mentorshipId, 's-blocked', 'resolved');

      assert.strictEqual(activeMentorships.size, 0);
    });

    it('should restore the mentor to flow and reset the mentee to idle after close', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      await useCase.closeMentorship(mentorship.mentorshipId, 's-blocked', 'resolved');

      const mentor = session.getStudent('s-mentor');
      const mentee = session.getStudent('s-blocked');

      // Mentor returns to the mentor pool (flow), mentee starts clean (idle).
      assert.strictEqual(mentor.state, 'flow');
      assert.strictEqual(mentor.activeMentorshipId, null);
      assert.strictEqual(mentee.state, 'idle');
      assert.strictEqual(mentee.activeMentorshipId, null);
    });

    it('should emit authoritative cognitive:state for both participants on close', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      mockIO.emitted.length = 0;
      await useCase.closeMentorship(mentorship.mentorshipId, 's-blocked', 'resolved');

      const stateEvents = mockIO.emitted.filter((e) => e.event === 'cognitive:state');
      const ids = stateEvents.map((e) => e.payload.studentId);
      assert.ok(ids.includes('s-mentor'), 'cognitive:state should be emitted for the mentor');
      assert.ok(ids.includes('s-blocked'), 'cognitive:state should be emitted for the mentee');
    });

    it('should emit mentorship:ended event', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      // Clear emitted events from setup
      mockIO.emitted.length = 0;

      await useCase.closeMentorship(mentorship.mentorshipId, 's-blocked', 'resolved');

      const endEvent = mockIO.emitted.find((e) => e.event === 'mentorship:ended');
      assert.ok(endEvent, 'mentorship:ended should be emitted');
      assert.strictEqual(endEvent.payload.reason, 'resolved');
    });

    it('should persist the close to the repository', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      // Reset repo calls from setup
      mockRepo.calls.closeMentorship.length = 0;
      mockRepo.calls.logEvent.length = 0;

      await useCase.closeMentorship(mentorship.mentorshipId, 's-blocked', 'resolved');

      assert.strictEqual(mockRepo.calls.closeMentorship.length, 1);
      assert.strictEqual(mockRepo.calls.closeMentorship[0].id, mentorship.mentorshipId);
      assert.strictEqual(mockRepo.calls.closeMentorship[0].status, 'completed');

      // Should log mentorship_end event
      const endLog = mockRepo.calls.logEvent.find((e) => e.eventType === 'mentorship_end');
      assert.ok(endLog, 'Should log mentorship_end event');
    });

    it('should handle closing a non-existent mentorship gracefully', async () => {
      // Should not throw
      await useCase.closeMentorship('non-existent-id', 'student-1', 'manual');
    });
  });

  // ── lookups (used by handlers & reconnect resync) ──

  describe('lookups', () => {
    it('getMentorship returns the active mentorship by id', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      assert.strictEqual(useCase.getMentorship(mentorship.mentorshipId), mentorship);
      assert.strictEqual(useCase.getMentorship('nope'), undefined);
    });

    it('getActiveMentorshipForStudent finds the pair for either participant', async () => {
      const session = new Session({ sessionId: SESSION_ID });
      session.addStudent(createBlockedStudent('s-blocked', SESSION_ID));
      session.addStudent(createFlowStudent('s-mentor', SESSION_ID));
      activeSessions.set(SESSION_ID, session);

      const mentorship = await useCase.attemptMatch(SESSION_ID, 's-blocked');
      assert.strictEqual(
        useCase.getActiveMentorshipForStudent('s-mentor', SESSION_ID),
        mentorship
      );
      assert.strictEqual(
        useCase.getActiveMentorshipForStudent('s-blocked', SESSION_ID),
        mentorship
      );
      assert.strictEqual(
        useCase.getActiveMentorshipForStudent('ghost', SESSION_ID),
        null
      );
    });
  });
});
