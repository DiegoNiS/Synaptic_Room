// ============================================
// Synaptic Room — Insecure-Mode Warning Middleware
// ============================================
// When the server runs WITHOUT authentication (NEXORA_DEV_INSECURE=true, only
// possible outside production), every request is stamped with a loud warning.
// This makes an insecure deployment impossible to ignore in the logs and adds a
// response header operators/proxies can alert on.
//
// Traceability: P0-R-002 · design P0-D-001 · verifies P0-AC-002.
// ============================================

import { env } from '../../../config/env.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('insecure-mode');

/**
 * Express middleware that warns on every request while auth is disabled.
 * In secure mode it is a no-op (single boolean check), so it is safe to always
 * register it in the middleware chain.
 * @type {import('express').RequestHandler}
 */
export function insecureModeWarning(req, res, next) {
  if (env.INSECURE_MODE) {
    res.setHeader('X-Nexora-Insecure-Mode', 'true');
    log.warn(
      { method: req.method, path: req.path },
      'INSECURE MODE — request served without authentication (NEXORA_DEV_INSECURE)'
    );
  }
  next();
}
