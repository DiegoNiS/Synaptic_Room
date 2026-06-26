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
