// ============================================
// Synaptic Room — Server Entry Point
// ============================================
// Composition Root: wires all layers together using manual dependency
// injection (no DI framework).
//
// Boot order:
//   1. Load and validate environment
//   2. Build the durable state runtime (Redis-backed or in-memory)
//   3. Create infrastructure adapters
//   4. Create application use cases (inject adapters + stores)
//   5. Create interfaces (HTTP + Socket.io with Redis adapter)
//   6. Start listening
//
// This is the ONLY file that knows about all layers.
// ============================================

import { createServer } from 'http';
import { env } from './config/env.js';
import { createComponentLogger } from './utils/logger.js';

// Infrastructure
import { AgentClient } from './infrastructure/ai/AgentClient.js';
import { TraceBuffer } from './infrastructure/queue/TraceBuffer.js';
import { SessionRepository } from './infrastructure/db/SessionRepository.js';
import { createStateRuntime } from './infrastructure/state/createStateRuntime.js';

// Application
import { TraceAnalysisUseCase } from './application/TraceAnalysisUseCase.js';
import { MentorshipUseCase } from './application/MentorshipUseCase.js';

// Interfaces
import { createApp } from './interfaces/http/app.js';
import { createSocketManager } from './interfaces/sockets/SocketManager.js';

const log = createComponentLogger('server');

// Flipped true when draining so readiness (/readyz) reports NOT ready.
let shuttingDown = false;
export const isShuttingDown = () => shuttingDown;

// ============================================
// 1. DURABLE STATE RUNTIME
// ============================================
// Externalized, Map-compatible state (survives restarts, scales horizontally
// when REDIS_URL is set). Falls back to a single-instance in-memory store.
const stateRuntime = await createStateRuntime(env);
const { sessionStore: activeSessions, mentorshipStore: activeMentorships } = stateRuntime;

// ============================================
// 2. INFRASTRUCTURE LAYER
// ============================================
const agentClient = new AgentClient({
  redisClient: stateRuntime.redisClient, // enables cross-instance breaker coordination
  instanceId: stateRuntime.instanceId,
});
const sessionRepository = new SessionRepository();

// ============================================
// 3. APPLICATION LAYER (Use Cases)
// ============================================
const mentorshipUseCase = new MentorshipUseCase({
  activeSessions,
  activeMentorships,
  sessionRepository,
  agentClient,
  io: null, // Will be set after Socket.io is created
});

const traceAnalysisUseCase = new TraceAnalysisUseCase({
  agentClient,
  sessionRepository,
  activeSessions,
  mentorshipUseCase,
  io: null, // Will be set after Socket.io is created
});

// TraceBuffer: connects the socket trace events to the analysis use case
const traceBuffer = new TraceBuffer({
  onFlush: (studentId, sessionId, aggregatedMetrics) =>
    traceAnalysisUseCase.execute(studentId, sessionId, aggregatedMetrics),
});

// ============================================
// 4. HTTP SERVER & SOCKET.IO
// ============================================
const app = createApp({
  agentClient,
  traceBuffer,
  activeSessions,
  stateRuntime,
  isShuttingDown,
});
const httpServer = createServer(app);

// ============================================
// 5. SOCKET.IO (Interfaces Layer)
// ============================================
const io = createSocketManager(httpServer, {
  activeSessions,
  sessionRepository,
  traceBuffer,
  mentorshipUseCase,
  socketAdapterClients: stateRuntime.socketAdapterClients,
});

// Wire the Socket.io instance back into the use cases
// (Circular dependency resolved via late binding)
mentorshipUseCase.io = io;
traceAnalysisUseCase.io = io;

// ============================================
// 6. START SERVER
// ============================================
httpServer.listen(env.PORT, () => {
  log.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      aiAgentUrl: env.AI_AGENT_BASE_URL,
      instanceId: stateRuntime.instanceId,
      durableState: Boolean(stateRuntime.redisClient),
    },
    `🧠 Synaptic Room server listening on port ${env.PORT}`
  );
  log.info('──────────────────────────────────────────');
  log.info(`   🌐 Health:   http://localhost:${env.PORT}/health`);
  log.info(`   ❤️  Liveness: http://localhost:${env.PORT}/healthz`);
  log.info(`   ✅ Readiness: http://localhost:${env.PORT}/readyz`);
  log.info(`   🔌 Socket:   ws://localhost:${env.PORT}`);
  log.info(`   🤖 AI Agent: ${env.AI_AGENT_BASE_URL}`);
  log.info('──────────────────────────────────────────');

  if (env.INSECURE_MODE) {
    log.warn('⚠️  INSECURE MODE — authentication is DISABLED (NEXORA_DEV_INSECURE).');
    log.warn('⚠️  This is for local development only and is blocked in production.');
  }
});

// ============================================
// 7. GRACEFUL SHUTDOWN (drain, then release state runtime)
// ============================================
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'Shutdown signal received — draining...');

  // Stop accepting new HTTP connections; readiness will already report NOT ready.
  httpServer.close();

  // Cleanup resources
  traceBuffer.destroy();
  mentorshipUseCase.destroy();
  io.close();

  // Release the durable state runtime (pub/sub + repository connections).
  try {
    await stateRuntime.close();
  } catch (err) {
    log.error({ err }, 'Error closing state runtime');
  }

  log.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections (prevents silent crashes in production)
process.on('unhandledRejection', (reason, promise) => {
  const errorDetails =
    reason instanceof Error ? { message: reason.message, stack: reason.stack } : { reason };
  log.fatal({ error: errorDetails, promise }, 'UNHANDLED REJECTION — this is a bug!');
});

process.on('uncaughtException', (error) => {
  log.fatal({ err: error }, 'UNCAUGHT EXCEPTION — shutting down');
  process.exit(1);
});
