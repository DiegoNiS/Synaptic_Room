// ============================================
// Synaptic Room — Auth Route (Join Token Issuance)
// ============================================
// POST /api/auth/join
//   body: { sessionId, role, displayName, studentId?, passcode? }
//   -> { studentId, sessionId, role, displayName, token, authEnabled }
//
// The token binds the identity to a session and role. The teacher role
// is gated behind TEACHER_PASSCODE when configured. The client then
// passes `token` in the Socket.io handshake auth.
// ============================================

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { signJoinToken, isAuthConfigured } from '../../../utils/tokenService.js';
import { env } from '../../../config/env.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('auth');

const clean = (val, max) =>
  typeof val === 'string' ? val.trim().slice(0, max) : '';

export function createAuthRouter() {
  const router = Router();

  router.post('/join', (req, res) => {
    const body = req.body || {};
    const sessionId = clean(body.sessionId, 64);
    const displayName = clean(body.displayName, 80);
    const userRole = body.role === 'teacher' ? 'teacher' : 'student';

    if (!sessionId || !displayName) {
      return res.status(400).json({ error: 'sessionId and displayName are required' });
    }

    // Gate teacher role behind the passcode when one is configured.
    if (userRole === 'teacher' && env.TEACHER_PASSCODE) {
      if (clean(body.passcode, 128) !== env.TEACHER_PASSCODE) {
        log.warn({ sessionId }, 'Teacher join rejected — bad passcode');
        return res.status(403).json({ error: 'Invalid teacher passcode' });
      }
    }

    // Identity: the teacher gets a stable per-session id; students keep their
    // supplied id (for reconnects) or receive a fresh server-generated one.
    const suppliedId = clean(body.studentId, 64);
    const resolvedId =
      userRole === 'teacher'
        ? `teacher-${sessionId}`
        : suppliedId || `stu-${randomUUID()}`;

    const identity = { studentId: resolvedId, sessionId, role: userRole, displayName };

    if (!isAuthConfigured()) {
      // No secret configured — return identity without a token (dev mode).
      return res.json({ ...identity, token: null, authEnabled: false });
    }

    const token = signJoinToken(identity);
    log.info({ sessionId, role: userRole }, 'Issued join token');
    return res.json({ ...identity, token, authEnabled: true });
  });

  return router;
}
