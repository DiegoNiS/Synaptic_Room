// ============================================
// Tests — Two-instance cluster: fan-out, resume, chaos failover
// ============================================
// Exercises the REAL Phase-1 machinery in one process:
//   • @socket.io/redis-adapter  → cross-instance event fan-out
//   • DurableEntityStore + Redis repo → shared, restart-proof state
//
// Scenarios:
//   1. A student on instance A changes state; a teacher on instance B sees it
//      (cross-instance consistency — P1-AC-003).
//   2. Instance A is KILLED mid-class; the student reconnects to instance B and
//      resumes their exact state (failover continuity + idempotent resume —
//      P1-AC-004 / P1-AC-005).
//
// Redis here is an in-process Redis-compatible server (ioredis-mock) shared by
// both instances; in staging this is a real Redis. Traceability: P1-R-002/003/004/008.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { createAdapter } from '@socket.io/redis-adapter';
import RedisMock from 'ioredis-mock';

import { RedisSessionStateRepository } from '../../src/infrastructure/state/RedisSessionStateRepository.js';
import { DurableEntityStore } from '../../src/infrastructure/state/DurableEntityStore.js';
import { Session } from '../../src/domain/models/Session.js';
import { Student } from '../../src/domain/models/Student.js';

function storeOver(repo, instanceId) {
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

// A minimal server instance wiring the REAL adapter + REAL durable store, with a
// handler that mirrors the essential join/state/resume behavior of the app.
async function makeInstance(repo, instanceId) {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  io.adapter(createAdapter(new RedisMock(), new RedisMock()));
  const store = storeOver(repo, instanceId);
  await store.init();

  io.on('connection', (socket) => {
    const { sessionId, role, studentId, displayName } = socket.handshake.auth;
    socket.join(sessionId);
    if (role === 'teacher') socket.join(`teacher:${sessionId}`);

    let session = store.get(sessionId);
    if (!session) {
      session = new Session({ sessionId });
      store.set(sessionId, session);
    }
    if (role !== 'teacher' && !session.getStudent(studentId)) {
      session.addStudent(new Student({ studentId, sessionId, displayName, state: 'idle' }));
      store.persist(session);
    }

    socket.on('student:state', ({ state, confidence }) => {
      const s = store.get(sessionId);
      const stu = s.getStudent(studentId);
      s.updateStudent(stu.withAnalysis({ state, confidence, blockagePoint: null }));
      store.persist(s);
      io.to(`teacher:${sessionId}`).emit('session:nodeMap', s.toNodeMap());
    });

    socket.on('session:resume', () => {
      const s = store.get(sessionId);
      const stu = s?.getStudent(studentId);
      if (stu)
        socket.emit('cognitive:state', { studentId, state: stu.state, confidence: stu.confidence });
    });
  });

  await new Promise((r) => httpServer.listen(0, r));
  return {
    port: httpServer.address().port,
    store,
    async close() {
      io.close();
      await new Promise((r) => httpServer.close(r));
      await store.close();
    },
  };
}

function waitFor(emitter, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    emitter.once(event, (...args) => {
      clearTimeout(t);
      resolve(args.length > 1 ? args : args[0]);
    });
  });
}

const connect = (port, auth) =>
  Client(`http://localhost:${port}`, { auth, transports: ['websocket'], reconnection: false });

const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

test('cross-instance fan-out: student on A, teacher on B sees the state change', async () => {
  const data = new RedisMock();
  await data.flushall();
  const repo = new RedisSessionStateRepository(data, { hotTtlSeconds: 60 });
  const A = await makeInstance(repo, 'A');
  const B = await makeInstance(repo, 'B');

  const teacher = connect(B.port, {
    sessionId: 'k1',
    role: 'teacher',
    studentId: 'teacher-k1',
    displayName: 'T',
  });
  await waitFor(teacher, 'connect');
  const student = connect(A.port, {
    sessionId: 'k1',
    role: 'student',
    studentId: 'stu1',
    displayName: 'S',
  });
  await waitFor(student, 'connect');
  await tick();

  const nodeMapP = waitFor(teacher, 'session:nodeMap');
  student.emit('student:state', { state: 'blocked', confidence: 0.8 });
  const nodeMap = await nodeMapP;

  const node = nodeMap.nodes.find((n) => n.studentId === 'stu1');
  assert.ok(node, 'teacher on B received the node for the student on A');
  assert.equal(node.state, 'blocked');

  student.close();
  teacher.close();
  await A.close();
  await B.close();
});

test('chaos failover: kill instance A, student reconnects to B and resumes state', async () => {
  const data = new RedisMock();
  await data.flushall();
  const repo = new RedisSessionStateRepository(data, { hotTtlSeconds: 60 });
  const A = await makeInstance(repo, 'A');
  const B = await makeInstance(repo, 'B');

  const student = connect(A.port, {
    sessionId: 'k2',
    role: 'student',
    studentId: 'stu9',
    displayName: 'S',
  });
  await waitFor(student, 'connect');
  student.emit('student:state', { state: 'blocked', confidence: 0.85 });
  await tick(120); // let the write persist + propagate to B

  // 💥 Instance A dies mid-class.
  student.close();
  await A.close();

  // Student reconnects to the surviving instance B.
  const student2 = connect(B.port, {
    sessionId: 'k2',
    role: 'student',
    studentId: 'stu9',
    displayName: 'S',
  });
  await waitFor(student2, 'connect');

  const resumed = waitFor(student2, 'cognitive:state');
  student2.emit('session:resume');
  const state = await resumed;

  assert.equal(state.state, 'blocked', 'state survived the death of instance A');
  assert.equal(state.confidence, 0.85);

  student2.close();
  await B.close();
});
