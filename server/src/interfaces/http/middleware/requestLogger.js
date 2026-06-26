// ============================================
// Synaptic Room — Request Logger Middleware
// ============================================

import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('http');

/**
 * Logs every incoming HTTP request with timing information.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log when the response finishes
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };

    if (res.statusCode >= 400) {
      log.warn(logData, 'Request completed with error');
    } else {
      log.info(logData, 'Request completed');
    }
  });

  next();
}
