// ============================================
// Tests — DistributedCircuitBreaker (cross-instance probe coordination)
// ============================================
// Verifies that, across instances sharing Redis, only ONE probes on recovery
// (no retry storm) — and that without Redis it behaves like the base breaker.
// Traceability: P1-R-006 · verifies P1-AC-007 · task P1-T-007.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import RedisMock from 'ioredis-mock';

import { DistributedCircuitBreaker } from '../../src/infrastructure/ai/DistributedCircuitBreaker.js';

const boom = () => Promise.reject(new Error('boom'));
const ok = () => Promise.resolve('ok');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('without Redis it behaves like a normal breaker (opens then recovers)', async () => {
  const cb = new DistributedCircuitBreaker({
    name: 'n1',
    failureThreshold: 1,
    resetTimeoutMs: 30,
    redis: null,
  });
  await assert.rejects(cb.execute(boom));
  assert.equal(cb.state, 'OPEN');
  await sleep(40);
  assert.equal(await cb.execute(ok), 'ok');
  assert.equal(cb.state, 'CLOSED');
});

test('only ONE instance probes in HALF_OPEN (no retry storm)', async () => {
  const data = new RedisMock();
  await data.flushall();
  const shared = () => new RedisMock(); // all mock clients share the same store

  const a = new DistributedCircuitBreaker({
    name: 'ai',
    failureThreshold: 1,
    resetTimeoutMs: 30,
    redis: shared(),
    instanceId: 'A',
  });
  const b = new DistributedCircuitBreaker({
    name: 'ai',
    failureThreshold: 1,
    resetTimeoutMs: 30,
    redis: shared(),
    instanceId: 'B',
  });

  // Both instances observe the failure and open.
  await assert.rejects(a.execute(boom));
  await assert.rejects(b.execute(boom));
  assert.equal(a.state, 'OPEN');
  assert.equal(b.state, 'OPEN');

  await sleep(40); // reset window elapses on both

  // Race both probes with a slow success fn. Exactly one should acquire the lock.
  const slowOk = () => new Promise((r) => setTimeout(() => r('ok'), 20));
  const results = await Promise.allSettled([a.execute(slowOk), b.execute(slowOk)]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejectedOpen = results.filter(
    (r) => r.status === 'rejected' && r.reason.code === 'CIRCUIT_OPEN'
  );
  assert.equal(fulfilled.length, 1, 'exactly one instance may probe');
  assert.equal(rejectedOpen.length, 1, 'the other instance is rejected as OPEN');
});

test('a failed probe keeps the lock (others stay OPEN that window)', async () => {
  const a = new DistributedCircuitBreaker({
    name: 'z',
    failureThreshold: 1,
    resetTimeoutMs: 30,
    redis: new RedisMock(),
    instanceId: 'A',
  });
  const b = new DistributedCircuitBreaker({
    name: 'z',
    failureThreshold: 1,
    resetTimeoutMs: 30,
    redis: new RedisMock(),
    instanceId: 'B',
  });
  await assert.rejects(a.execute(boom));
  await assert.rejects(b.execute(boom));
  await sleep(40);

  // A probes and FAILS → stays OPEN and retains the lock.
  await assert.rejects(a.execute(boom));
  assert.equal(a.state, 'OPEN');
  // B tries immediately: lock still held → rejected as OPEN (no storm).
  await assert.rejects(b.execute(ok), (e) => e.code === 'CIRCUIT_OPEN');
});
