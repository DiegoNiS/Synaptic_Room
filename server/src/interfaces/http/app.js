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
import { createHealthRouter } from './routes/health.js';

/**
 * Creates and configures the Express application.
 * @param {Object} deps - Dependencies for routes
 * @param {import('../../infrastructure/ai/AgentClient.js').AgentClient} deps.agentClient
 * @param {import('../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 * @param {Map} deps.activeSessions
 * @returns {import('express').Application}
 */
export function createApp({ agentClient, traceBuffer, activeSessions }) {
  const app = express();

  // ── Core Middleware ──
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // ── Routes ──
  app.use('/health', createHealthRouter({ agentClient, traceBuffer, activeSessions }));

  // ── Global Error Handler (must be last) ──
  app.use(errorHandler);

  return app;
}
