// ============================================
// Synaptic Room — Session Handler
// ============================================
// Handles join (implicit on connect) and leave (disconnect).
//
// Key behaviors:
//   - Teachers are NOT stored as Students (no duplicate dashboard node).
//   - A reconnecting student keeps their existing state and is RESYNCED
//     (own cognitive state + any active mentorship re-sent to them).
//   - A second connection for the same identity evicts the stale one.
//   - Session cleanup waits out a grace period and respects a watching teacher.
// ============================================

import { Student } from '../../../domain/models/Student.js';
import { Session } from '../../../domain/models/Session.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('session-handler');

const EMPTY_SESSION_GRACE_MS = 30_000;

export function registerSessionHandler(
  socket,
  { activeSessions, sessionRepository, traceBuffer, io, socketRegistry, mentorshipUseCase }
) {
  const { studentId, sessionId, role, displayName } = socket.data;
  const teacherKey = `teacher-${sessionId}`;

  handleJoin();
  socket.on('disconnect', (reason) => handleLeave(reason));

  function getOrCreateSession() {
    let session = activeSessions.get(sessionId);
    if (!session) {
      session = new Session({ sessionId });
      activeSessions.set(sessionId, session);
      log.info({ sessionId }, 'New session created');
      sessionRepository.createSession({
        sessionId,
        teacherId: role === 'teacher' ? studentId : null,
      });
    }
    return session;
  }

  // Evict any previous socket holding the same identity (e.g. a stale tab).
  function evictPrevious() {
    const prevSocketId = socketRegistry.register(sessionId, studentId, socket.id);
    if (prevSocketId) {
      const prev = io.sockets.sockets.get(prevSocketId);
      if (prev) {
        log.info({ studentId, prevSocketId }, 'Evicting previous socket for same identity');
        prev.disconnect(true);
      }
    }
  }

  function handleJoin() {
    const session = getOrCreateSession();
    evictPrevious();
    socket.join(sessionId);

    if (role === 'teacher') {
      socket.join(`teacher:${sessionId}`);
      session.teacherId = studentId;
      log.info({ sessionId, displayName }, 'Teacher joined session');
      // Send the current snapshot immediately to this teacher.
      socket.emit('session:nodeMap', session.toNodeMap());
      return;
    }

    // Preserve state across quick reconnects; only create fresh if unknown.
    let student = session.getStudent(studentId);
    if (!student) {
      student = new Student({ studentId, sessionId, displayName, state: 'idle' });
      session.addStudent(student);
    }

    log.info(
      { studentId, sessionId, displayName, totalStudents: session.studentCount },
      'Student joined session'
    );

    // ── Resync this (re)connecting client ──
    socket.emit('cognitive:state', {
      studentId: student.studentId,
      state: student.state,
      confidence: student.confidence,
      blockagePoint: student.blockagePoint,
    });
    const activeMentorship = mentorshipUseCase.getActiveMentorshipForStudent(studentId, sessionId);
    if (activeMentorship) {
      socket.emit('mentorship:start', activeMentorship.toStartPayload());
    }

    // Refresh the teacher dashboard.
    io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());
  }

  function handleLeave(reason) {
    const session = activeSessions.get(sessionId);

    // Only the CURRENT owner of this identity may tear down shared state —
    // a superseded socket (replaced by a newer tab) must not remove the live one.
    const isCurrent = socketRegistry.getSocketId(sessionId, studentId) === socket.id;
    socketRegistry.unregister(sessionId, studentId, socket.id);

    socket.leave(sessionId);
    socket.leave(`teacher:${sessionId}`);

    if (!session) return;

    if (role === 'teacher') {
      log.info({ sessionId, reason }, 'Teacher left session');
      maybeScheduleCleanup(session);
      return;
    }

    if (!isCurrent) {
      log.debug({ studentId }, 'Superseded socket left — keeping live student state');
      return;
    }

    session.removeStudent(studentId);
    traceBuffer.removeStudent(studentId, sessionId);
    log.info(
      { studentId, sessionId, reason, remainingStudents: session.studentCount },
      'Student left session'
    );
    maybeScheduleCleanup(session);
  }

  // Schedule deletion only when the room is truly empty (no students AND no
  // teacher watching). Re-checks after the grace window to survive reconnects.
  function maybeScheduleCleanup(session) {
    const teacherPresent = Boolean(socketRegistry.getSocketId(sessionId, teacherKey));
    if (session.studentCount > 0 || teacherPresent) {
      io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());
      return;
    }
    setTimeout(() => {
      const current = activeSessions.get(sessionId);
      const stillEmpty = current && current.studentCount === 0;
      const stillNoTeacher = !socketRegistry.getSocketId(sessionId, teacherKey);
      if (stillEmpty && stillNoTeacher) {
        activeSessions.delete(sessionId);
        sessionRepository.endSession(sessionId);
        log.info({ sessionId }, 'Empty session cleaned up');
      }
    }, EMPTY_SESSION_GRACE_MS);
  }
}
