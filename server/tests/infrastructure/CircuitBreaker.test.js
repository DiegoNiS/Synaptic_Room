// ============================================
// Tests — Circuit Breaker (dedicated suite)
// ============================================
// The circuit breaker is the technical anchor of NN-1 ("the system never
// depends on AI availability"). This suite exercises every state transition
// and the graceful-degradation contract.
// Traceability: P0-R-005 · verifies P0-AC-005 · task P0-T-007.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../../src/infrastructure/ai/CircuitBreaker.js';

const ok = () => Promise.resolve('ok');
const boom = () => Promise.reject(new Error('boom'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('starts CLOSED and passes calls through', async () => {
  const cb = new CircuitBreaker({ name: 't', failureThreshold: 3, resetTimeoutMs: 50 });
  assert.equal(cb.state, 'CLOSED');
  assert.equal(await cb.execute(ok), 'ok');
  assert.equal(cb.state, 'CLOSED');
});

test('CLOSED → OPEN after reaching the failure threshold', async () => {
  const cb = new CircuitBreaker({ name: 't', failureThreshold: 3, resetTimeoutMs: 50 });
  for (let i = 0; i < 3; i++) {
    await assert.rejects(cb.execute(boom), /boom/);
  }
  assert.equal(cb.state, 'OPEN');
});

test('OPEN rejects immediately with CIRCUIT_OPEN (no call to fn)', async () => {
  const cb = new CircuitBreaker({ name: 't', failureThreshold: 1, resetTimeoutMs: 10_000 });
  await assert.rejects(cb.execute(boom));
  assert.equal(cb.state, 'OPEN');

  let called = false;
  await assert.rejects(
    cb.execute(() => {
      called = true;
      return ok();
    }),
    (err) => err.code === 'CIRCUIT_OPEN'
  );
  assert.equal(called, false, 'fn must NOT be invoked while OPEN');
});

test('OPEN → HALF_OPEN → CLOSED on a successful probe after the reset timeout', async () => {
  const cb = new CircuitBreaker({ name: 't', failureThreshold: 1, resetTimeoutMs: 30 });
  await assert.rejects(cb.execute(boom));
  assert.equal(cb.state, 'OPEN');

  await sleep(40); // allow reset window to elapse
  const result = await cb.execute(ok); // probe succeeds
  assert.equal(result, 'ok');
  assert.equal(cb.state, 'CLOSED');
  assert.equal(cb.failureCount, 0);
});

test('OPEN → HALF_OPEN → OPEN when the probe fails', async () => {
  const cb = new CircuitBreaker({ name: 't', failureThreshold: 1, resetTimeoutMs: 30 });
  await assert.rejects(cb.execute(boom));
  await sleep(40);
  await assert.rejects(cb.execute(boom)); // probe fails → back to OPEN
  assert.equal(cb.state, 'OPEN');
});

test('getStatus exposes observable state for health checks', async () => {
  const cb = new CircuitBreaker({ name: 'ai', failureThreshold: 2, resetTimeoutMs: 50 });
  await cb.execute(ok);
  const status = cb.getStatus();
  assert.equal(status.name, 'ai');
  assert.equal(status.state, 'CLOSED');
  assert.equal(typeof status.successCount, 'number');
});
