// ============================================
// Synaptic Room — Server Entry Point
// ============================================
// Composition Root: Wires all layers together
// using manual dependency injection (no DI framework).
//
// Boot order:
//   1. Load and validate environment
//   2. Create infrastructure adapters
//   3. Create application use cases (inject adapters)
//   4. Create interfaces (inject use cases)
//   5. Start listening
//
// This is the ONLY file that knows about all layers.
// Every other file only knows about its dependencies.
// ============================================

import { createServer } from 'http';
import { env } from './config/env.js';
import { logger, createComponentLogger } from './utils/logger.js';

// Infrastructure
import { AgentClient } from './infrastructure/ai/AgentClient.js';
import { TraceBuffer } from './infrastructure/queue/TraceBuffer.js';
import { SessionRepository } from './infrastructure/db/SessionRepository.js';
import { Mentorship } from './domain/models/Mentorship.js';

// Application
import { TraceAnalysisUseCase } from './application/TraceAnalysisUseCase.js';
import { MentorshipUseCase } from './application/MentorshipUseCase.js';

// Interfaces
import { createApp } from './interfaces/http/app.js';
import { createSocketManager } from './interfaces/sockets/SocketManager.js';

const log = createComponentLogger('server');

// ============================================
// 1. IN-MEMORY STATE STORES
// ============================================
/** @type {Map<string, import('./domain/models/Session.js').Session>} */
const activeSessions = new Map();

/** @type {Map<string, Mentorship>} */
const activeMentorships = new Map();

// ============================================
// 2. INFRASTRUCTURE LAYER
// ============================================
const agentClient = new AgentClient();
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
const app = createApp({ agentClient, traceBuffer, activeSessions });
const httpServer = createServer(app);

// ============================================
// 5. SOCKET.IO (Interfaces Layer)
// ============================================
const io = createSocketManager(httpServer, {
  activeSessions,
  sessionRepository,
  traceBuffer,
  mentorshipUseCase,
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
    },
    `🧠 Synaptic Room server listening on port ${env.PORT}`
  );
  log.info('──────────────────────────────────────────');
  log.info(`   🌐 Health:  http://localhost:${env.PORT}/health`);
  log.info(`   🔌 Socket:  ws://localhost:${env.PORT}`);
  log.info(`   🤖 AI Agent: ${env.AI_AGENT_BASE_URL}`);
  log.info('──────────────────────────────────────────');
});

// ============================================
// 7. GRACEFUL SHUTDOWN
// ============================================
const shutdown = async (signal) => {
  log.info({ signal }, 'Shutdown signal received — cleaning up...');

  // Stop accepting new connections
  httpServer.close();

  // Cleanup resources
  traceBuffer.destroy();
  mentorshipUseCase.destroy();
  io.close();

  log.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections (prevents silent crashes in production)
process.on('unhandledRejection', (reason, promise) => {
  const errorDetails = reason instanceof Error ? { message: reason.message, stack: reason.stack } : { reason };
  log.fatal({ error: errorDetails, promise }, 'UNHANDLED REJECTION — this is a bug!');
});

process.on('uncaughtException', (error) => {
  log.fatal({ err: error }, 'UNCAUGHT EXCEPTION — shutting down');
  process.exit(1);
});
