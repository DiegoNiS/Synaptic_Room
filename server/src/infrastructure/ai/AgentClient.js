// ============================================
// Synaptic Room — AI Agent HTTP Client
// ============================================
// Communicates with Diego's FastAPI service
// for cognitive analysis. Wraps every call in:
//   1. Timeout enforcement (AbortController)
//   2. Retry with exponential backoff
//   3. Circuit Breaker protection
//
// ARCHITECTURE DECISION: Uses native fetch()
// (available in Node 18+) instead of axios to
// eliminate an external dependency. AbortController
// handles timeouts natively.
// ============================================

import { env } from '../../config/env.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import { retryWithBackoff } from '../../utils/retry.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('agent-client');

export class AgentClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - FastAPI base URL
   * @param {number} [options.timeoutMs] - Request timeout
   * @param {number} [options.maxRetries] - Max retry attempts
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || env.AI_AGENT_BASE_URL;
    this.timeoutMs = options.timeoutMs || env.AI_AGENT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries || env.AI_AGENT_MAX_RETRIES;
    this.apiKey = options.apiKey || env.AGENT_API_KEY;

    // Independent circuit breakers per endpoint: a flaky /match-mentor must
    // not blackout /analyze (they are separate failure domains).
    this.analyzeBreaker = new CircuitBreaker({
      name: 'ai-analyze',
      failureThreshold: env.CB_FAILURE_THRESHOLD,
      resetTimeoutMs: env.CB_RESET_TIMEOUT_MS,
    });
    this.matchBreaker = new CircuitBreaker({
      name: 'ai-match',
      failureThreshold: env.CB_FAILURE_THRESHOLD,
      resetTimeoutMs: env.CB_RESET_TIMEOUT_MS,
    });

    log.info(
      { baseUrl: this.baseUrl, timeoutMs: this.timeoutMs, maxRetries: this.maxRetries, authenticated: Boolean(this.apiKey) },
      'AI Agent client initialized'
    );
  }

  /**
   * Retry policy shared by both endpoints. Never retries 4xx (our fault) or
   * TIMEOUT (the request may still be running server-side — retrying just
   * amplifies cost and load on an already-slow service).
   * @param {Error} err
   * @returns {boolean}
   */
  _shouldRetry(err) {
    if (err.code === 'TIMEOUT') return false;
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) return false;
    return true;
  }

  /**
   * Sends a student's trace data to the AI Agent for cognitive analysis.
   *
   * @param {Object} tracePayload
   * @param {string} tracePayload.sessionId
   * @param {string} tracePayload.studentId
   * @param {Object} tracePayload.windowMetrics - Aggregated keystroke metrics
   * @param {Object} tracePayload.historicalContext - Previous state info
   * @returns {Promise<Object>} The analysis result from the agent
   * @throws {Error} After all retries exhausted or circuit breaker open
   */
  async analyzeTrace(tracePayload) {
    const startTime = Date.now();

    try {
      const result = await this.analyzeBreaker.execute(() =>
        retryWithBackoff(
          () => this._postWithTimeout('/analyze', tracePayload),
          {
            maxRetries: this.maxRetries,
            baseDelayMs: 500,
            maxDelayMs: 3000,
            operationName: `analyze(${tracePayload.studentId})`,
            shouldRetry: (err) => this._shouldRetry(err),
          }
        )
      );

      const latencyMs = Date.now() - startTime;
      log.info(
        { studentId: tracePayload.studentId, latencyMs, state: result?.analysis?.state },
        'AI analysis completed'
      );

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // If circuit is open, return a degraded response (not an error)
      if (error.code === 'CIRCUIT_OPEN') {
        log.warn(
          { studentId: tracePayload.studentId, latencyMs },
          'Circuit open — returning degraded response'
        );
        return this._degradedResponse(tracePayload.studentId, 'Circuit breaker open (AI service temporarily disabled)');
      }

      log.error(
        { err: error, studentId: tracePayload.studentId, latencyMs },
        'AI analysis failed after all attempts'
      );
      return this._degradedResponse(tracePayload.studentId, error.message);
    }
  }

  /**
   * Calls Cognitive Mesh to find the best mentor using enriched profiles.
   *
   * @param {Object} matchPayload
   * @param {string} matchPayload.blockedStudentId
   * @param {string} matchPayload.sessionId
   * @param {string|null} matchPayload.blockagePoint
   * @param {Array<{id: string, displayName: string, confidence: number, timeInFlowMs: number, currentChallenge: string|null}>} matchPayload.availableMentors
   * @returns {Promise<Object>} Match result with mentorId, blockedId, matchScore
   */
  async matchMentor(matchPayload) {
    const startTime = Date.now();
    try {
      const result = await this.matchBreaker.execute(() =>
        retryWithBackoff(
          () => this._postWithTimeout('/match-mentor', matchPayload),
          {
            maxRetries: this.maxRetries,
            baseDelayMs: 500,
            maxDelayMs: 3000,
            operationName: `matchMentor(${matchPayload.blockedStudentId})`,
            shouldRetry: (err) => this._shouldRetry(err),
          }
        )
      );

      const latencyMs = Date.now() - startTime;
      log.info(
        { blockedStudentId: matchPayload.blockedStudentId, latencyMs, mentorId: result?.mentorId, matchScore: result?.matchScore },
        'AI mentor matchmaking completed'
      );
      return result;
    } catch (error) {
      log.error({ err: error, blockedStudentId: matchPayload.blockedStudentId }, 'Cognitive Mesh matchmaking failed');
      return { mentorId: 'none', blockedId: matchPayload.blockedStudentId, matchScore: 0 };
    }
  }

  /**
   * Makes an HTTP POST with a strict timeout using AbortController.
   * @param {string} path - API endpoint path
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Parsed JSON response
   * @private
   */
  async _postWithTimeout(path, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}${path}`;
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['X-Agent-Key'] = this.apiKey;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`Agent API responded with ${response.status}`);
        error.statusCode = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Agent API timed out after ${this.timeoutMs}ms`);
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Returns a safe degraded response when the AI service is unavailable.
   * The student appears as 'idle' in the dashboard — not an error state.
   * This prevents the UI from breaking when Diego's service goes down.
   *
   * @param {string} studentId
   * @param {string} [errorMessage]
   * @returns {Object}
   * @private
   */
  _degradedResponse(studentId, errorMessage = 'AI service unavailable') {
    return {
      studentId,
      analysis: {
        state: 'idle',
        confidence: 0,
        blockagePoint: null,
        suggestedMentorProfile: null,
      },
      processingMs: 0,
      degraded: true,
      error: errorMessage,
    };
  }

  /**
   * Checks if the AI Agent service is reachable (health check).
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Returns the circuit breaker status for monitoring.
   * @returns {Object}
   */
  getStatus() {
    return {
      baseUrl: this.baseUrl,
      circuitBreakers: {
        analyze: this.analyzeBreaker.getStatus(),
        match: this.matchBreaker.getStatus(),
      },
    };
  }
}
