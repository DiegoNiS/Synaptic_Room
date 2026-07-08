// ============================================
// Synaptic Room — Health / Liveness / Readiness routes
// ============================================
// Three distinct probes (P1-R-007):
//   GET /health   — rich subsystem detail (kept for dashboards/back-compat).
//   GET /healthz  — LIVENESS: is the process up? Never depends on external deps,
//                   so an AI/Redis outage does NOT trigger a pod restart.
//   GET /readyz   — READINESS: should we receive traffic? 503 while draining or
//                   when the state store is unreachable. Crucially, a DEGRADED
//                   AI does NOT make us unready (NN-1: the classroom runs without AI).
// ============================================

import { Router } from 'express';

/**
 * @param {Object} deps
 * @param {import('../../../infrastructure/ai/AgentClient.js').AgentClient} deps.agentClient
 * @param {import('../../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 * @param {Map} deps.activeSessions
 * @param {Object} [deps.stateRuntime] - { repository, redisClient } for readiness checks.
 * @param {() => boolean} [deps.isShuttingDown]
 * @returns {Router}
 */
export function createHealthRouter({
  agentClient,
  traceBuffer,
  activeSessions,
  stateRuntime,
  isShuttingDown,
}) {
  const router = Router();
  const draining = () => (typeof isShuttingDown === 'function' ? isShuttingDown() : false);

  // ── Rich detail (kept at /health) ──
  router.get('/health', async (req, res) => {
    const aiHealthy = await agentClient.isHealthy();
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      subsystems: {
        server: { status: 'healthy' },
        aiAgent: { status: aiHealthy ? 'healthy' : 'degraded', ...agentClient.getStatus() },
        traceBuffer: traceBuffer.getStats(),
        sessions: { active: activeSessions.size },
        state: { durable: Boolean(stateRuntime?.redisClient) },
      },
    };
    // AI degraded is NOT a server failure (NN-1) — report 200, surface the detail.
    res.status(200).json(status);
  });

  // ── Liveness: process is running (no external dependency checks) ──
  router.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'alive', uptime: process.uptime() });
  });

  // ── Readiness: can we serve traffic right now? ──
  router.get('/readyz', async (req, res) => {
    if (draining()) {
      return res.status(503).json({ status: 'draining', ready: false });
    }

    // The state store MUST be reachable to serve the classroom.
    let stateReady = true;
    if (stateRuntime?.repository?.ping) {
      try {
        stateReady = await stateRuntime.repository.ping();
      } catch {
        stateReady = false;
      }
    }

    const ready = stateReady;
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not-ready',
      ready,
      checks: {
        state: stateReady ? 'ok' : 'unreachable',
        // AI is informational only — its state never blocks readiness (NN-1).
        aiBreaker: agentClient.getStatus?.()?.state ?? 'unknown',
      },
    });
  });

  return router;
}
