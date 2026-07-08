// ============================================
// Tests — Domain serialization round-trips
// ============================================
// Durable state depends on lossless (de)serialization of the domain entities.
// Traceability: P1-R-001 · verifies P1-AC-001/002.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Student } from '../../src/domain/models/Student.js';
import { Session } from '../../src/domain/models/Session.js';
import { Mentorship } from '../../src/domain/models/Mentorship.js';

test('Student survives a JSON round-trip with every field intact', () => {
  const s = new Student({
    studentId: 'stu-1',
    sessionId: 'sess-1',
    displayName: 'Ada',
    state: 'blocked',
    confidence: 0.8,
    blockagePoint: 'límite 0/0',
    activeMentorshipId: null,
    stateChangedAt: 1000,
    preMentorshipState: 'flow',
    preMentorshipConfidence: 0.9,
  });
  const revived = Student.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  assert.deepEqual(revived.toJSON(), s.toJSON());
  assert.ok(revived instanceof Student);
  assert.equal(revived.isBlocked(), true);
});

test('Session round-trips with all its students and stays queryable', () => {
  const session = new Session({ sessionId: 'sess-1', teacherId: 'teacher-sess-1' });
  session.addStudent(
    new Student({
      studentId: 'a',
      sessionId: 'sess-1',
      displayName: 'A',
      state: 'flow',
      confidence: 0.9,
    })
  );
  session.addStudent(
    new Student({
      studentId: 'b',
      sessionId: 'sess-1',
      displayName: 'B',
      state: 'blocked',
      confidence: 0.7,
    })
  );

  const revived = Session.fromJSON(JSON.parse(JSON.stringify(session.toJSON())));
  assert.equal(revived.studentCount, 2);
  assert.ok(revived.getStudent('a') instanceof Student);
  assert.equal(revived.getStudent('b').state, 'blocked');
  // Behavior preserved: the mentor pool query still works after rehydration.
  assert.equal(revived.findBestMentor('b').studentId, 'a');
  // Node map (teacher dashboard) renders from the rehydrated session.
  assert.equal(revived.toNodeMap().nodes.length, 3); // 2 students + teacher root
});

test('Mentorship round-trips with lifecycle fields', () => {
  const m = new Mentorship({
    sessionId: 'sess-1',
    mentorId: 'a',
    mentorName: 'A',
    menteeId: 'b',
    menteeName: 'B',
    topic: 'grafos',
  });
  const revived = Mentorship.fromJSON(JSON.parse(JSON.stringify(m.toJSON())));
  assert.deepEqual(revived.toJSON(), m.toJSON());
  assert.equal(revived.isActive(), true);
});
