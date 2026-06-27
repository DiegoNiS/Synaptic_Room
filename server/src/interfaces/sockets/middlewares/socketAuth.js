// ============================================
// Synaptic Room — Socket Authentication Middleware
// ============================================
// Runs during the Socket.io handshake.
//
// When JOIN_TOKEN_SECRET is configured (always in production), the client
// MUST present a signed join token (issued by POST /api/auth/join). The
// trusted identity is derived FROM the token — never from raw client fields —
// which prevents impersonating another student or self-promoting to teacher.
//
// When no secret is configured (local dev), it falls back to presence
// validation of the handshake fields and logs a loud warning.
// ============================================

import { verifyJoinToken, isAuthConfigured } from '../../../utils/tokenService.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('socket-auth');
const VALID_ROLES = ['student', 'teacher'];

export function socketAuthMiddleware(socket, next) {
  const auth = socket.handshake.auth || {};

  if (isAuthConfigured()) {
    try {
      const claims = verifyJoinToken(auth.token);
      if (!VALID_ROLES.includes(claims.role)) {
        return next(new Error(`Authentication error: invalid role "${claims.role}"`));
      }
      socket.data = {
        studentId: claims.studentId,
        sessionId: claims.sessionId,
        role: claims.role,
        displayName: claims.displayName,
        connectedAt: Date.now(),
      };
      log.info(
        { studentId: claims.studentId, sessionId: claims.sessionId, role: claims.role },
        'Socket authenticated via signed token'
      );
      return next();
    } catch (err) {
      log.warn(
        { remoteAddress: socket.handshake.address, reason: err.message },
        'Socket connection rejected — invalid join token'
      );
      return next(new Error('Authentication error: invalid or expired join token'));
    }
  }

  // ── Dev fallback (no secret configured): presence validation only ──
  const { studentId, sessionId, role, displayName } = auth;
  if (!studentId || !sessionId || !displayName) {
    return next(new Error('Authentication error: studentId, sessionId, and displayName are required'));
  }
  const userRole = role || 'student';
  if (!VALID_ROLES.includes(userRole)) {
    return next(new Error(`Authentication error: invalid role "${userRole}"`));
  }

  socket.data = { studentId, sessionId, role: userRole, displayName, connectedAt: Date.now() };
  log.warn(
    { studentId, sessionId, role: userRole },
    'Socket authenticated WITHOUT a token (JOIN_TOKEN_SECRET not set — dev mode only)'
  );
  next();
}
