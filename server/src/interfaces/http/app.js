// ============================================
// Synaptic Room — Express Application
// ============================================
// Configures the Express app with all middleware.
// DOES NOT start the server — that's server.js's job.
// This separation allows testing the app without
// binding to a port.
// ============================================

import express from 'express';
import cors from 'cors';
import { getCorsOptions } from '../../config/cors.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { insecureModeWarning } from './middleware/insecureModeWarning.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';

/**
 * Creates and configures the Express application.
 * @param {Object} deps - Dependencies for routes
 * @param {import('../../infrastructure/ai/AgentClient.js').AgentClient} deps.agentClient
 * @param {import('../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 * @param {Map} deps.activeSessions
 * @param {Object} [deps.stateRuntime] - Durable state runtime (repository + redis) for readiness.
 * @param {() => boolean} [deps.isShuttingDown] - Reports drain state for readiness.
 * @returns {import('express').Application}
 */
export function createApp({
  agentClient,
  traceBuffer,
  activeSessions,
  stateRuntime,
  isShuttingDown,
}) {
  const app = express();

  // ── Core Middleware ──
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  // Loud, per-request warning whenever auth is disabled (no-op in secure mode).
  app.use(insecureModeWarning);

  // ── Routes ──
  // /health (legacy detail), plus /healthz (liveness) and /readyz (readiness).
  app.use(
    '/',
    createHealthRouter({ agentClient, traceBuffer, activeSessions, stateRuntime, isShuttingDown })
  );
  // Token issuance is rate-limited (auth endpoint = abuse target).
  app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 30 }), createAuthRouter());

  // ── Global Error Handler (must be last) ──
  app.use(errorHandler);

  return app;
}
