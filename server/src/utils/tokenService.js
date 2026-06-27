// ============================================
// Synaptic Room — Join Token Service (HMAC)
// ============================================
// Issues and verifies short-lived, signed join tokens so the
// socket layer can trust the (studentId, sessionId, role) identity
// instead of believing whatever the client puts in the handshake.
//
// This is a minimal, dependency-free HS256-style token:
//   base64url(payload).base64url(HMAC-SHA256(payload))
// It is NOT a full JWT, but it is signed and expiring, which is
// what the socket handshake actually needs.
// ============================================

import crypto from 'crypto';
import { env } from '../config/env.js';

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12h — comfortably longer than a class

const b64url = (str) => Buffer.from(str, 'utf8').toString('base64url');
const fromB64url = (str) => Buffer.from(str, 'base64url').toString('utf8');

function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/** Whether signed tokens are enforced (a secret is configured). */
export function isAuthConfigured() {
  return Boolean(env.JOIN_TOKEN_SECRET);
}

/**
 * Signs a join token binding an identity to a session+role.
 * @param {{studentId:string, sessionId:string, role:string, displayName:string}} claims
 * @param {number} [ttlMs]
 * @returns {string}
 */
export function signJoinToken(claims, ttlMs = DEFAULT_TTL_MS) {
  if (!env.JOIN_TOKEN_SECRET) {
    throw new Error('JOIN_TOKEN_SECRET is not configured');
  }
  const payload = {
    studentId: claims.studentId,
    sessionId: claims.sessionId,
    role: claims.role,
    displayName: claims.displayName,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body, env.JOIN_TOKEN_SECRET)}`;
}

/**
 * Verifies a join token and returns its claims, or throws.
 * @param {string} token
 * @returns {{studentId:string, sessionId:string, role:string, displayName:string, iat:number, exp:number}}
 */
export function verifyJoinToken(token) {
  if (!env.JOIN_TOKEN_SECRET) {
    throw new Error('JOIN_TOKEN_SECRET is not configured');
  }
  if (!token || typeof token !== 'string') {
    throw new Error('Missing token');
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) {
    throw new Error('Malformed token');
  }
  const expected = hmac(body, env.JOIN_TOKEN_SECRET);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(fromB64url(body));
  if (!payload.exp || Date.now() > payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}
