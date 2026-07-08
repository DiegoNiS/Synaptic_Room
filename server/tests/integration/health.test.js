// ============================================
// Tests — Liveness / Readiness probes
// ============================================
// Verifies /healthz (always alive if the process runs) and /readyz (503 while
// draining or when the state store is unreachable; a DEGRADED AI does NOT make
// us unready — NN-1).
// Traceability: P1-R-007 · verifies P1-AC-008 · task P1-T-008.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createHealthRouter } from '../../src/interfaces/http/routes/health.js';

async function withServer({ pingResult = true, draining = false, aiHealthy = false }, run) {
  const app = express();
  app.use(
    '/',
    createHealthRouter({
      agentClient: {
        isHealthy: async () => aiHealthy,
        getStatus: () => ({ state: aiHealthy ? 'CLOSED' : 'OPEN' }),
      },
      traceBuffer: { getStats: () => ({ buffered: 0 }) },
      activeSessions: { size: 0 },
      stateRuntime: {
        redisClient: {},
        repository: { ping: async () => pingResult },
      },
      isShuttingDown: () => draining,
    })
  );
  const server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    await run(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('GET /healthz is 200 alive regardless of dependencies', async () => {
  await withServer({ pingResult: false, aiHealthy: false }, async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'alive');
  });
});

test('GET /readyz is 200 when the state store is reachable', async () => {
  await withServer({ pingResult: true }, async (base) => {
    const res = await fetch(`${base}/readyz`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ready, true);
  });
});

test('GET /readyz stays ready when the AI is degraded (NN-1)', async () => {
  await withServer({ pingResult: true, aiHealthy: false }, async (base) => {
    const res = await fetch(`${base}/readyz`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ready, true);
    assert.equal(body.checks.aiBreaker, 'OPEN'); // surfaced but not blocking
  });
});

test('GET /readyz is 503 while draining', async () => {
  await withServer({ pingResult: true, draining: true }, async (base) => {
    const res = await fetch(`${base}/readyz`);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).ready, false);
  });
});

test('GET /readyz is 503 when the state store is unreachable', async () => {
  await withServer({ pingResult: false }, async (base) => {
    const res = await fetch(`${base}/readyz`);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).checks.state, 'unreachable');
  });
});
