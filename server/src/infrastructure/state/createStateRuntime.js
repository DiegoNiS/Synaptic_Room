// ============================================
// Synaptic Room — State runtime assembler
// ============================================
// Single place that wires the durable-state world for the composition root:
//   repository  → Redis or in-memory (from config)
//   sessionStore / mentorshipStore → Map-compatible, write-through, cross-instance
//   socket adapter pub/sub clients → for @socket.io/redis-adapter (horizontal scale)
//
// Returns everything the composition root needs plus a single close() for a
// clean shutdown. Redis is optional throughout (in-memory single-instance path).
//
// Traceability: P1-R-001/002 · design P1-D-001/D-002.
// ============================================

import { randomUUID } from 'node:crypto';
import { createSessionStateRepository } from './createSessionStateRepository.js';
import { DurableEntityStore } from './DurableEntityStore.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('state-runtime');

/**
 * @param {import('../../config/env.js').env} env
 * @returns {Promise<{
 *   repository: import('../../application/ports/SessionStateRepository.js').SessionStateRepository,
 *   sessionStore: DurableEntityStore,
 *   mentorshipStore: DurableEntityStore,
 *   redisClient: import('ioredis').Redis | null,
 *   socketAdapterClients: { pubClient: any, subClient: any } | null,
 *   instanceId: string,
 *   close: () => Promise<void>,
 * }>}
 */
export async function createStateRuntime(env) {
  const instanceId = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const { repository, redisClient } = await createSessionStateRepository(env);

  // Pub/sub clients are only needed when Redis is enabled. A subscriber client
  // cannot issue normal commands, so it must be separate from the main client.
  const storePub = redisClient ? redisClient.duplicate() : null;
  const storeSub = redisClient ? redisClient.duplicate() : null;
  const socketPub = redisClient ? redisClient.duplicate() : null;
  const socketSub = redisClient ? redisClient.duplicate() : null;
  for (const c of [storePub, storeSub, socketPub, socketSub]) {
    if (c) c.on('error', (err) => log.error({ err }, 'redis pub/sub client error'));
  }

  const sessionStore = new DurableEntityStore({
    name: 'sessions',
    load: (id) => repository.getSession(id),
    save: (e) => repository.saveSession(e),
    remove: (id) => repository.deleteSession(id),
    listIds: () => repository.listSessionIds(),
    idOf: (e) => e.sessionId,
    instanceId,
    pubClient: storePub,
    subClient: storeSub,
  });

  const mentorshipStore = new DurableEntityStore({
    name: 'mentorships',
    load: (id) => repository.getMentorship(id),
    save: (e) => repository.saveMentorship(e),
    remove: (id) => repository.deleteMentorship(id),
    listIds: () => repository.listMentorshipIds(),
    idOf: (e) => e.mentorshipId,
    instanceId,
    pubClient: storePub,
    subClient: storeSub,
  });

  await sessionStore.init();
  await mentorshipStore.init();

  const socketAdapterClients = redisClient ? { pubClient: socketPub, subClient: socketSub } : null;

  async function close() {
    await sessionStore.close();
    await mentorshipStore.close();
    for (const c of [storePub, storeSub, socketPub, socketSub]) {
      if (c) await c.quit().catch(() => {});
    }
    await repository.close();
  }

  log.info({ instanceId, redis: Boolean(redisClient) }, 'State runtime ready');
  return {
    repository,
    sessionStore,
    mentorshipStore,
    redisClient,
    socketAdapterClients,
    instanceId,
    close,
  };
}
