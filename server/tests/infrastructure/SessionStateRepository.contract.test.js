// ============================================
// Tests — SessionStateRepository contract
// ============================================
// One behavioral contract, run against BOTH adapters: the in-memory adapter and
// the Redis adapter (backed by an in-memory Redis-compatible server). This is
// what proves a restart/other-instance can rehydrate the exact state (P1-R-001).
// Traceability: P1-R-001/002 · verifies P1-AC-001/002.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import RedisMock from 'ioredis-mock';

import { InMemorySessionStateRepository } from '../../src/infrastructure/state/InMemorySessionStateRepository.js';
import { RedisSessionStateRepository } from '../../src/infrastructure/state/RedisSessionStateRepository.js';
import { Session } from '../../src/domain/models/Session.js';
import { Student } from '../../src/domain/models/Student.js';
import { Mentorship } from '../../src/domain/models/Mentorship.js';

function makeSession(id = 'sess-1') {
  const s = new Session({ sessionId: id, teacherId: `teacher-${id}` });
  s.addStudent(
    new Student({ studentId: 'a', sessionId: id, displayName: 'A', state: 'flow', confidence: 0.9 })
  );
  s.addStudent(
    new Student({
      studentId: 'b',
      sessionId: id,
      displayName: 'B',
      state: 'blocked',
      confidence: 0.7,
    })
  );
  return s;
}

function makeMentorship(id = 'sess-1') {
  return new Mentorship({
    sessionId: id,
    mentorId: 'a',
    mentorName: 'A',
    menteeId: 'b',
    menteeName: 'B',
    topic: 'grafos',
  });
}

/**
 * @param {string} name
 * @param {() => Promise<import('../../src/application/ports/SessionStateRepository.js').SessionStateRepository>} makeRepo
 *   Async factory returning a FRESH, empty repository per test.
 */
function runContract(name, makeRepo) {
  test(`[${name}] save/get session rehydrates identical state`, async () => {
    const repo = await makeRepo();
    const session = makeSession();
    await repo.saveSession(session);

    const loaded = await repo.getSession('sess-1');
    assert.ok(loaded);
    assert.deepEqual(loaded.toJSON(), session.toJSON());
    // Domain behavior survives the round-trip through the store.
    assert.equal(loaded.findBestMentor('b').studentId, 'a');
    await repo.close();
  });

  test(`[${name}] getSession returns null for a missing id`, async () => {
    const repo = await makeRepo();
    assert.equal(await repo.getSession('nope'), null);
    await repo.close();
  });

  test(`[${name}] listSessionIds tracks live sessions and drops deleted ones`, async () => {
    const repo = await makeRepo();
    await repo.saveSession(makeSession('s1'));
    await repo.saveSession(makeSession('s2'));
    let ids = (await repo.listSessionIds()).sort();
    assert.deepEqual(ids, ['s1', 's2']);

    await repo.deleteSession('s1');
    ids = await repo.listSessionIds();
    assert.deepEqual(ids, ['s2']);
    assert.equal(await repo.getSession('s1'), null);
    await repo.close();
  });

  test(`[${name}] mentorships: save/get/list/delete`, async () => {
    const repo = await makeRepo();
    const m = makeMentorship();
    await repo.saveMentorship(m);

    const loaded = await repo.getMentorship(m.mentorshipId);
    assert.deepEqual(loaded.toJSON(), m.toJSON());
    assert.deepEqual(await repo.listMentorshipIds(), [m.mentorshipId]);

    await repo.deleteMentorship(m.mentorshipId);
    assert.deepEqual(await repo.listMentorshipIds(), []);
    await repo.close();
  });

  test(`[${name}] ping reports readiness`, async () => {
    const repo = await makeRepo();
    assert.equal(await repo.ping(), true);
    await repo.close();
  });
}

runContract('in-memory', async () => new InMemorySessionStateRepository());
runContract('redis', async () => {
  // ioredis-mock shares one in-memory store across instances; flush for isolation.
  const client = new RedisMock();
  await client.flushall();
  return new RedisSessionStateRepository(client, { hotTtlSeconds: 60 });
});
