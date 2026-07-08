// ============================================
// Tests — DurableEntityStore (write-through + cross-instance sync + rehydrate)
// ============================================
// Proves the durability + horizontal-scale contract that lets a class survive a
// restart and stay consistent across instances.
// Traceability: P1-R-001/002/003 · verifies P1-AC-001/003.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import RedisMock from 'ioredis-mock';

import { RedisSessionStateRepository } from '../../src/infrastructure/state/RedisSessionStateRepository.js';
import { DurableEntityStore } from '../../src/infrastructure/state/DurableEntityStore.js';
import { Session } from '../../src/domain/models/Session.js';
import { Student } from '../../src/domain/models/Student.js';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function makeSession(id) {
  const s = new Session({ sessionId: id, teacherId: `teacher-${id}` });
  s.addStudent(
    new Student({ studentId: 'a', sessionId: id, displayName: 'A', state: 'flow', confidence: 0.9 })
  );
  return s;
}

function sessionStoreOver(repo, instanceId) {
  return new DurableEntityStore({
    name: 'sessions',
    load: (id) => repo.getSession(id),
    save: (e) => repo.saveSession(e),
    remove: (id) => repo.deleteSession(id),
    listIds: () => repo.listSessionIds(),
    idOf: (e) => e.sessionId,
    instanceId,
    pubClient: new RedisMock(),
    subClient: new RedisMock(),
  });
}

test('set() writes through to the repository (durability)', async () => {
  const data = new RedisMock();
  await data.flushall();
  const repo = new RedisSessionStateRepository(data, { hotTtlSeconds: 60 });
  const store = sessionStoreOver(repo, 'A');
  await store.init();

  store.set('s1', makeSession('s1'));
  await tick();
  // A brand-new store rehydrating from the same repo sees it (== restart).
  const fresh = sessionStoreOver(repo, 'B');
  await fresh.init();
  assert.ok(fresh.get('s1'));
  assert.equal(fresh.get('s1').getStudent('a').state, 'flow');
  await store.close();
  await fresh.close();
});

test('rehydrates existing state on init (survives a restart)', async () => {
  const data = new RedisMock();
  await data.flushall();
  const repo = new RedisSessionStateRepository(data, { hotTtlSeconds: 60 });
  await repo.saveSession(makeSession('s9'));

  const store = sessionStoreOver(repo, 'A');
  await store.init();
  assert.equal(store.size, 1);
  assert.ok(store.get('s9'));
  await store.close();
});

test('cross-instance sync: a write on A appears on B via pub/sub', async () => {
  const data = new RedisMock();
  await data.flushall();
  const repo = new RedisSessionStateRepository(data, { hotTtlSeconds: 60 });

  const storeA = sessionStoreOver(repo, 'A');
  const storeB = sessionStoreOver(repo, 'B');
  await storeA.init();
  await storeB.init();

  storeA.set('s2', makeSession('s2')); // write on instance A
  await tick(60); // allow pub/sub to propagate

  assert.ok(storeB.get('s2'), 'instance B should see the session A wrote');

  storeA.delete('s2'); // delete on A
  await tick(60);
  assert.equal(storeB.get('s2'), undefined, 'instance B should drop the deleted session');

  await storeA.close();
  await storeB.close();
});

test('persist() propagates in-place mutations across instances', async () => {
  const data = new RedisMock();
  await data.flushall();
  const repo = new RedisSessionStateRepository(data, { hotTtlSeconds: 60 });
  const storeA = sessionStoreOver(repo, 'A');
  const storeB = sessionStoreOver(repo, 'B');
  await storeA.init();
  await storeB.init();

  const session = makeSession('s3');
  storeA.set('s3', session);
  await tick(60);

  // Mutate in place on A, then persist.
  session.updateStudent(
    session.getStudent('a').withAnalysis({ state: 'blocked', confidence: 0.8, blockagePoint: 'x' })
  );
  storeA.persist(session);
  await tick(60);

  assert.equal(storeB.get('s3').getStudent('a').state, 'blocked');
  await storeA.close();
  await storeB.close();
});
