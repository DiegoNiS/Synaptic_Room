// ============================================
// Synaptic Room — Mentor Handler
// ============================================
// Handles mentorship socket events (close / message / draw).
//
// Every event is authorized: the caller must be the mentor or mentee of the
// referenced mentorship. Chat and draw are delivered ONLY to the partner's
// socket (via the SocketRegistry), never broadcast to the whole session.
// ============================================

import { SOCKET_INCOMING } from '../../../domain/events/DomainEvents.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('mentor-handler');

/**
 * @param {import('socket.io').Socket} socket
 * @param {Object} deps
 * @param {import('../../../application/MentorshipUseCase.js').MentorshipUseCase} deps.mentorshipUseCase
 * @param {import('socket.io').Server} deps.io
 * @param {import('../SocketRegistry.js').SocketRegistry} deps.socketRegistry
 */
export function registerMentorHandler(socket, { mentorshipUseCase, io, socketRegistry }) {
  const { studentId, sessionId } = socket.data;

  /**
   * Resolves the mentorship and verifies the caller participates in it.
   * @returns {{ mentorship: import('../../../domain/models/Mentorship.js').Mentorship, partnerId: string } | null}
   */
  function authorizeParticipant(mentorshipId) {
    const mentorship = mentorshipUseCase.getMentorship(mentorshipId);
    if (!mentorship) return null;
    if (mentorship.mentorId !== studentId && mentorship.menteeId !== studentId) {
      log.warn({ studentId, mentorshipId }, 'Rejected mentorship event — caller is not a participant');
      return null;
    }
    const partnerId = mentorship.mentorId === studentId ? mentorship.menteeId : mentorship.mentorId;
    return { mentorship, partnerId };
  }

  /** Emits an event to a specific student's socket, if connected. */
  function emitToStudent(targetStudentId, event, payload) {
    const socketId = socketRegistry?.getSocketId(sessionId, targetStudentId);
    if (socketId) io.to(socketId).emit(event, payload);
    return Boolean(socketId);
  }

  // ── Close ──
  socket.on(SOCKET_INCOMING.MENTORSHIP_CLOSE, async (payload) => {
    try {
      if (!payload?.mentorshipId || !payload?.reason) {
        socket.emit('session:error', { message: 'Invalid payload: mentorshipId and reason are required' });
        return;
      }
      const validReasons = ['resolved', 'timeout', 'manual'];
      if (!validReasons.includes(payload.reason)) {
        log.warn({ studentId, reason: payload.reason }, 'Invalid close reason');
        return;
      }
      if (!authorizeParticipant(payload.mentorshipId)) {
        socket.emit('session:error', { message: 'Not authorized to close this mentorship' });
        return;
      }

      await mentorshipUseCase.closeMentorship(payload.mentorshipId, studentId, payload.reason);
      log.info({ studentId, mentorshipId: payload.mentorshipId, reason: payload.reason }, 'Mentorship closed');
    } catch (error) {
      log.error({ err: error, studentId }, 'Error closing mentorship');
      socket.emit('session:error', { message: 'Failed to close mentorship session' });
    }
  });

  // ── Chat message (delivered privately to the partner) ──
  socket.on(SOCKET_INCOMING.MENTORSHIP_MESSAGE, (payload) => {
    try {
      if (!payload?.mentorshipId || !payload?.message) return;
      const auth = authorizeParticipant(payload.mentorshipId);
      if (!auth) return;

      emitToStudent(auth.partnerId, 'mentorship:message', {
        mentorshipId: payload.mentorshipId,
        from: studentId,
        fromName: socket.data.displayName,
        message: String(payload.message).slice(0, 500),
        timestamp: Date.now(),
      });
    } catch (error) {
      log.error({ err: error, studentId }, 'Error forwarding mentorship message');
    }
  });

  // ── Shared-whiteboard strokes (delivered privately to the partner) ──
  socket.on(SOCKET_INCOMING.MENTORSHIP_DRAW, (payload) => {
    try {
      if (!payload?.mentorshipId || !payload?.stroke) return;
      const auth = authorizeParticipant(payload.mentorshipId);
      if (!auth) return;

      const { stroke } = payload;
      if (
        typeof stroke.x0 !== 'number' || typeof stroke.y0 !== 'number' ||
        typeof stroke.x1 !== 'number' || typeof stroke.y1 !== 'number'
      ) {
        return;
      }

      emitToStudent(auth.partnerId, 'mentorship:draw', {
        mentorshipId: payload.mentorshipId,
        from: studentId,
        stroke: {
          x0: stroke.x0, y0: stroke.y0, x1: stroke.x1, y1: stroke.y1,
          color: String(stroke.color || '#6366f1').slice(0, 20),
          brushSize: Math.min(Math.max(Number(stroke.brushSize) || 3, 1), 50),
          tool: stroke.tool === 'eraser' ? 'eraser' : 'pencil',
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      log.error({ err: error, studentId }, 'Error relaying canvas stroke');
    }
  });
}
