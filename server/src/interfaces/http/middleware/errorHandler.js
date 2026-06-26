// ============================================
// Synaptic Room — Global Error Handler
// ============================================
// Catches all unhandled errors in Express routes.
// Returns consistent JSON error responses and
// prevents stack traces from leaking in production.
// ============================================

import { createComponentLogger } from '../../../utils/logger.js';
import { env } from '../../../config/env.js';

const log = createComponentLogger('error-handler');

/**
 * Global Express error handler.
 * Must have 4 parameters for Express to recognize it as an error handler.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProduction = env.NODE_ENV === 'production';

  log.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    },
    'Unhandled error in route'
  );

  res.status(statusCode).json({
    error: {
      message: isProduction && statusCode === 500
        ? 'Internal server error'
        : err.message,
      code: err.code || 'INTERNAL_ERROR',
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
