// ============================================
// Synaptic Room — Retry with Exponential Backoff
// ============================================
// Generic retry utility for any async operation.
// Used primarily by AgentClient to retry failed
// HTTP calls to the AI service with increasing delays.
// ============================================

import { createComponentLogger } from './logger.js';

const log = createComponentLogger('retry');

/**
 * Executes an async function with exponential backoff retries.
 * 
 * @param {() => Promise<T>} fn - The async function to retry
 * @param {Object} options
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [options.baseDelayMs=500] - Base delay between retries (doubles each time)
 * @param {number} [options.maxDelayMs=5000] - Maximum delay cap
 * @param {string} [options.operationName='operation'] - Name for logging
 * @param {(error: Error) => boolean} [options.shouldRetry] - Predicate to decide if error is retryable
 * @returns {Promise<T>}
 * @template T
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    operationName = 'operation',
    shouldRetry = () => true,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if the error is non-retryable
      if (!shouldRetry(error)) {
        log.warn(
          { err: error, attempt, operationName },
          'Non-retryable error, aborting'
        );
        throw error;
      }

      if (attempt === maxRetries) {
        log.error(
          { err: error, attempt, maxRetries, operationName },
          'All retry attempts exhausted'
        );
        break;
      }

      // Exponential backoff with jitter to avoid thundering herd
      const jitter = Math.random() * 200;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + jitter, maxDelayMs);

      log.warn(
        { attempt, maxRetries, delayMs: Math.round(delay), operationName },
        'Retrying after failure'
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
