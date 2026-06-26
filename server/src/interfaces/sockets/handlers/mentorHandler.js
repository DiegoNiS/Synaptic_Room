// ============================================
// Synaptic Room — Mentor Handler
// ============================================
// Handles mentorship-related socket events:
// closing, messaging between mentor/mentee pairs.
// ============================================

import { SOCKET_INCOMING } from '../../../domain/events/DomainEvents.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('mentor-handler');

/**
 * Registers mentorship event handlers on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Object} deps
 * @param {import('../../../application/MentorshipUseCase.js').MentorshipUseCase} deps.mentorshipUseCase
 */
export function registerMentorHandler(socket, { mentorshipUseCase }) {
  const { studentId } = socket.data;

  /**
   * Handles a request to close a mentorship session.
   * Can be triggered by either the mentor or the mentee.
   *
   * Expected payload:
   * {
   *   mentorshipId: string,
   *   reason: 'resolved' | 'timeout' | 'manual'
   * }
   */
  socket.on(SOCKET_INCOMING.MENTORSHIP_CLOSE, async (payload) => {
    try {
      if (!payload?.mentorshipId || !payload?.reason) {
        log.warn({ studentId }, 'Invalid mentorship close payload');
        socket.emit('session:error', {
          message: 'Invalid payload: mentorshipId and reason are required',
        });
        return;
      }

      const validReasons = ['resolved', 'timeout', 'manual'];
      if (!validReasons.includes(payload.reason)) {
        log.warn({ studentId, reason: payload.reason }, 'Invalid close reason');
        return;
      }

      await mentorshipUseCase.closeMentorship(
        payload.mentorshipId,
        studentId,
        payload.reason
      );

      log.info(
        { studentId, mentorshipId: payload.mentorshipId, reason: payload.reason },
        'Mentorship close request processed'
      );
    } catch (error) {
      log.error({ err: error, studentId }, 'Error closing mentorship');
      socket.emit('session:error', {
        message: 'Failed to close mentorship session',
      });
    }
  });

  /**
   * Handles messages between mentor and mentee during a session.
   * This enables real-time chat within the mentorship panel.
   *
   * Expected payload:
   * {
   *   mentorshipId: string,
   *   message: string,
   *   targetStudentId: string
   * }
   */
  socket.on(SOCKET_INCOMING.MENTORSHIP_MESSAGE, (payload) => {
    try {
      if (!payload?.mentorshipId || !payload?.message || !payload?.targetStudentId) {
        return;
      }

      // Forward the message directly to the target student's socket
      // Uses Socket.io's `to()` to send to a specific room/socket
      socket.to(socket.data.sessionId).emit('mentorship:message', {
        mentorshipId: payload.mentorshipId,
        from: studentId,
        fromName: socket.data.displayName,
        message: payload.message.slice(0, 500), // Cap message length
        timestamp: Date.now(),
      });
    } catch (error) {
      log.error({ err: error, studentId }, 'Error forwarding mentorship message');
    }
  });
}
