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
// The tokenless fallback ONLY applies when the server was explicitly booted in
// insecure dev mode (NEXORA_DEV_INSECURE=true, impossible in production). In any
// other case a missing/invalid token is rejected — there is no silent open door.
// ============================================

import { verifyJoinToken, isAuthConfigured } from '../../../utils/tokenService.js';
import { env } from '../../../config/env.js';
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

  // ── Insecure dev fallback: only when explicitly opted in (never in prod) ──
  // Defense in depth: if we somehow reach here without a secret AND without the
  // explicit insecure flag, refuse the connection rather than open the door.
  if (!env.INSECURE_MODE) {
    log.warn(
      { remoteAddress: socket.handshake.address },
      'Socket connection rejected — auth not configured and insecure mode is OFF'
    );
    return next(new Error('Authentication error: server is misconfigured (no auth)'));
  }

  const { studentId, sessionId, role, displayName } = auth;
  if (!studentId || !sessionId || !displayName) {
    return next(
      new Error('Authentication error: studentId, sessionId, and displayName are required')
    );
  }
  const userRole = role || 'student';
  if (!VALID_ROLES.includes(userRole)) {
    return next(new Error(`Authentication error: invalid role "${userRole}"`));
  }

  socket.data = { studentId, sessionId, role: userRole, displayName, connectedAt: Date.now() };
  log.warn(
    { studentId, sessionId, role: userRole },
    'INSECURE MODE — socket authenticated WITHOUT a token (NEXORA_DEV_INSECURE)'
  );
  next();
}
