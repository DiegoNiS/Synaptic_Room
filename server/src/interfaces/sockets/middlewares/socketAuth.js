// ============================================
// Synaptic Room — Socket Authentication Middleware
// ============================================
// Validates every incoming socket connection
// during the handshake phase. In a production system,
// this would verify JWT tokens. For the hackathon MVP,
// it validates the presence of required connection params.
// ============================================

import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('socket-auth');

/**
 * Socket.io middleware that runs on every new connection attempt.
 * Validates that the client provides required authentication data.
 *
 * Expected handshake auth object from Maxs's frontend:
 * {
 *   studentId: string,
 *   sessionId: string,
 *   role: 'student' | 'teacher',
 *   displayName: string
 * }
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
export function socketAuthMiddleware(socket, next) {
  const { studentId, sessionId, role, displayName } = socket.handshake.auth || {};

  // Validate required fields
  if (!studentId || !sessionId || !displayName) {
    log.warn(
      { remoteAddress: socket.handshake.address },
      'Socket connection rejected — missing auth fields'
    );
    return next(new Error('Authentication error: studentId, sessionId, and displayName are required'));
  }

  // Validate role
  const validRoles = ['student', 'teacher'];
  const userRole = role || 'student';
  if (!validRoles.includes(userRole)) {
    return next(new Error(`Authentication error: invalid role "${userRole}"`));
  }

  // Attach validated data to the socket for downstream handlers
  socket.data = {
    studentId,
    sessionId,
    role: userRole,
    displayName,
    connectedAt: Date.now(),
  };

  log.info(
    { studentId, sessionId, role: userRole, displayName },
    'Socket authenticated successfully'
  );

  next();
}
