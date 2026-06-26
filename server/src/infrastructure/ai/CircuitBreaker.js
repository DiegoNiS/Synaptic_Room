// ============================================
// Synaptic Room — Circuit Breaker Pattern
// ============================================
// Protects the Node.js event loop from cascading
// failures when the AI Agent service (FastAPI)
// becomes unavailable or slow.
//
// States:
//   CLOSED   → Normal operation, all requests pass through
//   OPEN     → Service is down, requests are rejected immediately
//   HALF_OPEN → Testing if service recovered (1 probe request)
// ============================================

import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('circuit-breaker');

/**
 * @typedef {'CLOSED' | 'OPEN' | 'HALF_OPEN'} CircuitState
 */

export class CircuitBreaker {
  /**
   * @param {Object} options
   * @param {number} [options.failureThreshold=5] - Consecutive failures before opening
   * @param {number} [options.resetTimeoutMs=30000] - Time in OPEN before testing recovery
   * @param {string} [options.name='default'] - Name for logging
   */
  constructor({ failureThreshold = 5, resetTimeoutMs = 30000, name = 'default' } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;

    /** @type {CircuitState} */
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;

    log.info(
      { name, failureThreshold, resetTimeoutMs },
      'Circuit breaker initialized'
    );
  }

  /**
   * Executes a function through the circuit breaker.
   * @param {() => Promise<T>} fn - The async function to protect
   * @returns {Promise<T>}
   * @throws {Error} When circuit is OPEN or fn fails after exhausting breaker
   * @template T
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (this._shouldAttemptReset()) {
        this._transitionTo('HALF_OPEN');
      } else {
        const error = new Error(`Circuit breaker [${this.name}] is OPEN — request rejected`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Checks if enough time has passed to attempt recovery.
   * @returns {boolean}
   * @private
   */
  _shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.resetTimeoutMs;
  }

  /**
   * Records a successful call and resets the breaker if needed.
   * @private
   */
  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      log.info({ name: this.name }, 'Circuit breaker recovered → CLOSED');
      this._transitionTo('CLOSED');
    }
    this.failureCount = 0;
    this.successCount++;
  }

  /**
   * Records a failure and potentially opens the breaker.
   * @param {Error} error
   * @private
   */
  _onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    log.warn(
      { name: this.name, failureCount: this.failureCount, threshold: this.failureThreshold, err: error },
      'Circuit breaker recorded failure'
    );

    if (this.state === 'HALF_OPEN') {
      // Recovery attempt failed → back to OPEN
      this._transitionTo('OPEN');
    } else if (this.failureCount >= this.failureThreshold) {
      this._transitionTo('OPEN');
    }
  }

  /**
   * Transitions the circuit breaker to a new state.
   * @param {CircuitState} newState
   * @private
   */
  _transitionTo(newState) {
    const prevState = this.state;
    this.state = newState;

    if (newState === 'CLOSED') {
      this.failureCount = 0;
    }

    log.info(
      { name: this.name, from: prevState, to: newState },
      'Circuit breaker state transition'
    );
  }

  /**
   * Returns the current state for health checks and monitoring.
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }
}
