// ============================================
// Synaptic Room — Distributed Circuit Breaker
// ============================================
// Extends the single-instance CircuitBreaker with cross-instance coordination
// so that, when the AI service recovers, only ONE server instance sends the
// probe request instead of every instance hammering it simultaneously (a
// "retry storm"). Coordination is a short-lived Redis lock:
//
//   OPEN + reset window elapsed → try SET probe:<name> <id> NX PX <window>
//     acquired → this instance transitions HALF_OPEN and probes
//     not acquired → another instance is probing; stay effectively OPEN
//   probe succeeds → release the lock (normal service resumes everywhere)
//   probe fails    → keep the lock until it expires (no storm next window)
//
// With no Redis client it behaves EXACTLY like the base breaker (single
// instance). This preserves NN-1 (degradation) and NN-3 (AI re-integrates
// in an orderly way rather than being removed).
//
// Traceability: P1-R-006 · design P1-D-003 · ADR-005.
// ============================================

import { CircuitBreaker } from './CircuitBreaker.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('dist-circuit-breaker');

export class DistributedCircuitBreaker extends CircuitBreaker {
  /**
   * @param {Object} options
   * @param {import('ioredis').Redis|null} [options.redis] - Coordination client (optional).
   * @param {string} [options.instanceId]
   * @param {number} [options.failureThreshold]
   * @param {number} [options.resetTimeoutMs]
   * @param {string} [options.name]
   */
  constructor({ redis = null, instanceId = 'local', ...base } = {}) {
    super(base);
    this._redis = redis;
    this._instanceId = instanceId;
    this._probeKey = `cb:probe:${this.name}`;
  }

  /** Try to become the single prober for this window. */
  async _acquireProbe() {
    if (!this._redis) return true; // no coordination → local behavior
    try {
      const ok = await this._redis.set(
        this._probeKey,
        this._instanceId,
        'PX',
        this.resetTimeoutMs,
        'NX'
      );
      return ok === 'OK';
    } catch (err) {
      // If coordination fails, fail OPEN-safe: allow a local probe rather than
      // blocking recovery forever.
      log.warn({ err, name: this.name }, 'probe lock error — allowing local probe');
      return true;
    }
  }

  async _releaseProbe() {
    if (!this._redis) return;
    try {
      await this._redis.del(this._probeKey);
    } catch {
      // best effort; the lock TTL will clean up
    }
  }

  /**
   * Same contract as CircuitBreaker.execute, but the OPEN→HALF_OPEN probe is
   * gated by a cross-instance lock.
   * @param {() => Promise<any>} fn
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (this._shouldAttemptReset()) {
        const gotProbe = await this._acquireProbe();
        if (gotProbe) {
          this._transitionTo('HALF_OPEN');
        } else {
          const error = new Error(
            `Circuit breaker [${this.name}] is OPEN — another instance is probing`
          );
          error.code = 'CIRCUIT_OPEN';
          throw error;
        }
      } else {
        const error = new Error(`Circuit breaker [${this.name}] is OPEN — request rejected`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    try {
      const result = await fn();
      const wasHalfOpen = this.state === 'HALF_OPEN';
      this._onSuccess();
      if (wasHalfOpen) await this._releaseProbe(); // recovery confirmed → free the lock
      return result;
    } catch (error) {
      this._onFailure(error);
      // On a failed probe we intentionally KEEP the lock so no other instance
      // re-probes until it expires (prevents a coordinated storm).
      throw error;
    }
  }
}
