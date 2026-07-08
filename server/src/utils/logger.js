// ============================================
// Synaptic Room — Structured Logger (Pino)
// ============================================
// Production-grade structured JSON logging.
// In development: human-readable with pino-pretty.
// In production: raw JSON for log aggregators
// (Datadog, CloudWatch, ELK).
// ============================================

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// ── Secret redaction (P0-R-003: secrets must never reach logs) ──
// Defense in depth: even if a secret is accidentally attached to a log object,
// pino replaces it with "[REDACTED]" before serialization. Keep this list in
// sync with SECRET_ENV_KEYS in config/env.js (the source of truth). We hardcode
// it here — rather than importing env — so the logger stays usable even while
// the configuration itself is being validated.
const SECRET_FIELD_NAMES = [
  'JOIN_TOKEN_SECRET',
  'AGENT_API_KEY',
  'TEACHER_PASSCODE',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'token',
  'passcode',
  'password',
  'authorization',
  'apiKey',
];

// Redact each field at the top level, one level deep (e.g. `env.*`, `claims.*`),
// and inside request headers. Exported so tests can assert the policy directly.
export const REDACT_PATHS = [
  ...SECRET_FIELD_NAMES,
  ...SECRET_FIELD_NAMES.map((f) => `*.${f}`),
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
];

/**
 * @type {import('pino').Logger}
 * Global application logger with structured output.
 *
 * Usage:
 *   logger.info({ component: 'socket', studentId: '...' }, 'Trace received');
 *   logger.error({ err, component: 'ai-client' }, 'Agent request failed');
 */
export const logger = pino({
  level: isDev ? 'debug' : 'info',

  // Never serialize secrets, even if accidentally attached to a log object.
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },

  // Base fields attached to every log line
  base: {
    service: 'synaptic-server',
    version: '1.0.0',
  },

  // Timestamp in ISO format for human readability in aggregators
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  // Pretty print in development only
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service,version',
      },
    },
  }),
});

/**
 * Creates a child logger scoped to a specific component.
 * @param {string} component - Component name (e.g., 'socket', 'ai-client')
 * @returns {import('pino').Logger}
 */
export function createComponentLogger(component) {
  return logger.child({ component });
}
