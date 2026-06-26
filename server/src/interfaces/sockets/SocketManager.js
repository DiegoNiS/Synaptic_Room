// ============================================
// Synaptic Room — Socket Manager
// ============================================
// Bootstraps Socket.io, registers all middlewares
// and handlers, and wires them to the dependency
// injection container.
//
// This is the SINGLE ENTRY POINT for all WebSocket
// configuration. No socket logic lives outside
// this module and its handlers.
// ============================================

import { Server } from 'socket.io';
import { getCorsOptions } from '../../config/cors.js';
import { socketAuthMiddleware } from './middlewares/socketAuth.js';
import { registerSessionHandler } from './handlers/sessionHandler.js';
import { registerTraceHandler } from './handlers/traceHandler.js';
import { registerMentorHandler } from './handlers/mentorHandler.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('socket-manager');

/**
 * Creates and configures the Socket.io server.
 *
 * @param {import('http').Server} httpServer - The HTTP server to attach to
 * @param {Object} deps - All dependencies for socket handlers
 * @param {Map} deps.activeSessions
 * @param {import('../../infrastructure/db/SessionRepository.js').SessionRepository} deps.sessionRepository
 * @param {import('../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 * @param {import('../../application/MentorshipUseCase.js').MentorshipUseCase} deps.mentorshipUseCase
 * @returns {Server} The Socket.io server instance
 */
export function createSocketManager(httpServer, deps) {
  const corsOptions = getCorsOptions();

  const io = new Server(httpServer, {
    cors: {
      origin: corsOptions.origin,
      methods: corsOptions.methods,
      credentials: corsOptions.credentials,
    },
    // Performance tuning for high-frequency events
    pingInterval: 10000,      // Heartbeat every 10s
    pingTimeout: 5000,        // Consider disconnected after 5s no response
    maxHttpBufferSize: 1e5,   // 100KB max per message (prevents abuse)
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000, // 30s recovery window
      skipMiddlewares: false,
    },
  });

  // ── Global Middleware ──
  io.use(socketAuthMiddleware);

  // ── Connection Handler ──
  io.on('connection', (socket) => {
    log.info(
      {
        socketId: socket.id,
        studentId: socket.data.studentId,
        sessionId: socket.data.sessionId,
        role: socket.data.role,
      },
      'New socket connection established'
    );

    // Register all event handlers for this socket
    // Each handler receives the socket AND the dependency container
    registerSessionHandler(socket, { ...deps, io });
    registerTraceHandler(socket, deps);
    registerMentorHandler(socket, deps);

    // ── Error handling per socket ──
    socket.on('error', (error) => {
      log.error(
        { err: error, socketId: socket.id, studentId: socket.data.studentId },
        'Socket error'
      );
    });
  });

  // ── Engine-level error handling ──
  io.engine.on('connection_error', (error) => {
    log.error(
      { err: error, code: error.code, message: error.message },
      'Socket.io engine connection error'
    );
  });

  log.info('Socket.io server configured and ready');

  return io;
}
