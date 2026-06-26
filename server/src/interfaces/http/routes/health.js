// ============================================
// Synaptic Room — Health Check Route
// ============================================
// Provides liveness and readiness probes for
// monitoring systems and the hackathon demo.
// Returns the status of all critical subsystems.
// ============================================

import { Router } from 'express';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('health');

/**
 * Creates the health check router.
 * @param {Object} deps
 * @param {import('../../../infrastructure/ai/AgentClient.js').AgentClient} deps.agentClient
 * @param {import('../../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 * @param {Map} deps.activeSessions
 * @returns {Router}
 */
export function createHealthRouter({ agentClient, traceBuffer, activeSessions }) {
  const router = Router();

  /**
   * GET /health
   * Returns the overall health status and subsystem details.
   */
  router.get('/', async (req, res) => {
    const aiHealthy = await agentClient.isHealthy();

    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      subsystems: {
        server: { status: 'healthy' },
        aiAgent: {
          status: aiHealthy ? 'healthy' : 'degraded',
          ...agentClient.getStatus(),
        },
        traceBuffer: traceBuffer.getStats(),
        sessions: {
          active: activeSessions.size,
        },
      },
    };

    const httpStatus = aiHealthy ? 200 : 207; // 207 = Multi-Status (partial health)
    res.status(httpStatus).json(status);
  });

  return router;
}
