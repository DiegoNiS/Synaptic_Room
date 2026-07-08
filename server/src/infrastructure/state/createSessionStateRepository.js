// ============================================
// Synaptic Room — State repository factory
// ============================================
// Chooses the state adapter from configuration:
//   - REDIS_URL set   → RedisSessionStateRepository (durable, horizontally scalable)
//   - REDIS_URL unset → InMemorySessionStateRepository (single instance / dev)
//
// In production WITHOUT Redis the classroom cannot survive a restart or scale
// out (violates the intent of P1); we warn loudly rather than silently degrade.
//
// Traceability: P1-R-001/002 · design P1-D-001.
// ============================================

import { InMemorySessionStateRepository } from './InMemorySessionStateRepository.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('state-factory');

/**
 * @param {import('../../config/env.js').env} env
 * @returns {Promise<{ repository: import('../../application/ports/SessionStateRepository.js').SessionStateRepository, redisClient: import('ioredis').Redis | null }>}
 */
export async function createSessionStateRepository(env) {
  if (!env.REDIS_URL) {
    if (env.IS_PROD) {
      log.warn(
        'REDIS_URL is not set — using IN-MEMORY state in production. The classroom will NOT ' +
          'survive a restart and the server cannot scale horizontally. Set REDIS_URL for durability.'
      );
    } else {
      log.info('REDIS_URL not set — using in-memory state (single instance / dev).');
    }
    return { repository: new InMemorySessionStateRepository(), redisClient: null };
  }

  // Dynamic import so environments without Redis never need the dependency loaded.
  const { default: Redis } = await import('ioredis');
  const { RedisSessionStateRepository } = await import('./RedisSessionStateRepository.js');

  const redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    // Keep trying to reconnect; the circuit breaker / readiness probe surface outages.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  redisClient.on('error', (err) => log.error({ err }, 'Redis client error'));
  redisClient.on('ready', () => log.info('Redis connection ready — durable state enabled'));

  const repository = new RedisSessionStateRepository(redisClient, {
    hotTtlSeconds: env.STATE_HOT_TTL_S,
  });

  return { repository, redisClient };
}
