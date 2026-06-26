// ============================================
// Synaptic Room — Trace Handler
// ============================================
// Receives real-time keystroke trace events from
// the frontend and pushes them into the TraceBuffer.
// The buffer handles aggregation and triggers AI
// analysis when the window is full.
//
// This handler is intentionally thin — it validates
// the incoming payload and delegates everything
// to the infrastructure layer.
// ============================================

import { SOCKET_INCOMING } from '../../../domain/events/DomainEvents.js';
import { createComponentLogger } from '../../../utils/logger.js';

const log = createComponentLogger('trace-handler');

/**
 * Registers the trace event handler on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Object} deps
 * @param {import('../../../infrastructure/queue/TraceBuffer.js').TraceBuffer} deps.traceBuffer
 */
export function registerTraceHandler(socket, { traceBuffer }) {
  const { studentId, sessionId } = socket.data;

  /**
   * Handles incoming keystroke trace events.
   * Expected payload from Maxs's frontend:
   * {
   *   timestamp: number (Unix ms),
   *   metrics: {
   *     wpm: number,
   *     pauseDurationMs: number,
   *     deletionCount: number,
   *     keystrokeCount: number,
   *     textSnapshot: string
   *   }
   * }
   */
  socket.on(SOCKET_INCOMING.STUDENT_TRACE, (payload) => {
    try {
      // ── Payload validation ──
      if (!payload || !payload.metrics) {
        log.warn({ studentId }, 'Invalid trace payload — missing metrics');
        return;
      }

      const { metrics, timestamp } = payload;

      // Validate required metric fields
      if (typeof metrics.wpm !== 'number' || typeof metrics.keystrokeCount !== 'number') {
        log.warn({ studentId }, 'Invalid trace metrics — wpm and keystrokeCount must be numbers');
        return;
      }

      // ── Push into the buffer ──
      // The buffer handles: accumulation → aggregation → AI call → state update
      traceBuffer.push(studentId, sessionId, {
        timestamp: timestamp || Date.now(),
        wpm: metrics.wpm,
        pauseDurationMs: metrics.pauseDurationMs || 0,
        deletionCount: metrics.deletionCount || 0,
        keystrokeCount: metrics.keystrokeCount,
        textSnapshot: (metrics.textSnapshot || '').slice(-200), // Cap at 200 chars
      });
    } catch (error) {
      log.error({ err: error, studentId }, 'Error processing trace event');
    }
  });
}
