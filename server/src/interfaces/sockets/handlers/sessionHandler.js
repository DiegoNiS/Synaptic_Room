// ============================================
// Synaptic Room — Session Handler
// ============================================
// Handles student join/leave events and manages
// Socket.io rooms. This is where students are
// added to the in-memory session model and placed
// in the correct room for real-time broadcasts.
// ============================================

import { Student } from '../../../domain/models/Student.js';
import { Session } from '../../../domain/models/Session.js';
import { SOCKET_INCOMING } from '../../../domain/events/DomainEvents.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('session-handler');

/**
 * Registers session lifecycle event handlers on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Object} deps
 * @param {Map<string, Session>} deps.activeSessions
 * @param {import('../../../infrastructure/db/SessionRepository.js').SessionRepository} deps.sessionRepository
 * @param {import('../../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 * @param {import('socket.io').Server} deps.io
 */
export function registerSessionHandler(socket, { activeSessions, sessionRepository, traceBuffer, io }) {
  const { studentId, sessionId, role, displayName } = socket.data;

  // ── Auto-join on connection ──
  // The socket auth middleware already validated these fields,
  // so we can safely use them here.
  handleJoin();

  // ── Disconnect handler ──
  socket.on('disconnect', (reason) => {
    handleLeave(reason);
  });

  /**
   * Handles a student joining a session.
   */
  function handleJoin() {
    // Get or create the session
    let session = activeSessions.get(sessionId);
    if (!session) {
      session = new Session({ sessionId });
      activeSessions.set(sessionId, session);
      log.info({ sessionId }, 'New session created');

      // Persist to Supabase (fire-and-forget)
      sessionRepository.createSession({ sessionId, teacherId: role === 'teacher' ? studentId : null });
    }

    // Create the student domain entity
    const student = new Student({
      studentId,
      sessionId,
      displayName,
      state: 'idle',
    });

    session.addStudent(student);

    // Join the Socket.io room for this session
    socket.join(sessionId);

    // Teachers get a separate room for dashboard-only events
    if (role === 'teacher') {
      socket.join(`teacher:${sessionId}`);
      session.teacherId = studentId;
    }

    log.info(
      { studentId, sessionId, role, displayName, totalStudents: session.studentCount },
      'Student joined session'
    );

    // Broadcast updated node map to the teacher
    io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());
  }

  /**
   * Handles a student leaving (disconnect or explicit leave).
   * @param {string} reason
   */
  function handleLeave(reason) {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // Remove from domain model
    session.removeStudent(studentId);

    // Clean up trace buffer
    traceBuffer.removeStudent(studentId, sessionId);

    // Leave Socket.io rooms
    socket.leave(sessionId);
    socket.leave(`teacher:${sessionId}`);

    log.info(
      { studentId, sessionId, reason, remainingStudents: session.studentCount },
      'Student left session'
    );

    // If the session is empty, clean it up after a grace period
    if (session.studentCount === 0) {
      setTimeout(() => {
        const currentSession = activeSessions.get(sessionId);
        if (currentSession && currentSession.studentCount === 0) {
          activeSessions.delete(sessionId);
          sessionRepository.endSession(sessionId);
          log.info({ sessionId }, 'Empty session cleaned up');
        }
      }, 30_000); // 30s grace period for reconnections
    } else {
      // Update teacher dashboard
      io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());
    }
  }
}
