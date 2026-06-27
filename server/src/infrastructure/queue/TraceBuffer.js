// ============================================
// Synaptic Room — Trace Buffer (Sliding Window)
// ============================================
// In-memory buffer that collects keystroke traces
// per student and flushes them to the AI Agent
// in optimized batches instead of per-event.
//
// WHY THIS EXISTS:
// Without buffering, 30 students × 2 events/sec =
// 60 HTTP calls/sec to the AI service. With this
// buffer (window=5, flush=3s), we reduce to:
// 30 students × 1 call/3s = 10 calls/sec.
// That's an 83% reduction in AI service load.
// ============================================

import { env } from '../../config/env.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('trace-buffer');

/**
 * @typedef {Object} TraceEvent
 * @property {number} timestamp - Unix ms when the event occurred
 * @property {number} wpm - Words per minute
 * @property {number} pauseDurationMs - Longest pause in the window
 * @property {number} deletionCount - Number of deletions
 * @property {number} keystrokeCount - Total keystrokes
 * @property {string} textSnapshot - Last 200 chars of text
 */

/**
 * @typedef {Object} StudentBuffer
 * @property {TraceEvent[]} events - Accumulated trace events
 * @property {NodeJS.Timeout|null} flushTimer - Auto-flush timer
 * @property {boolean} pendingAnalysis - Whether an analysis call is in flight
 */

export class TraceBuffer {
  /**
   * @param {Object} options
   * @param {number} [options.windowSize] - Events before auto-flush
   * @param {number} [options.flushIntervalMs] - Max time before forced flush
   * @param {(studentId: string, sessionId: string, aggregated: Object) => Promise<void>} options.onFlush
   *   Callback invoked when a buffer is ready for analysis
   */
  constructor({ windowSize, flushIntervalMs, onFlush }) {
    this.windowSize = windowSize || env.TRACE_BUFFER_WINDOW_SIZE;
    this.flushIntervalMs = flushIntervalMs || env.TRACE_BUFFER_FLUSH_INTERVAL_MS;
    this.onFlush = onFlush;

    /** @type {Map<string, StudentBuffer>} */
    this.buffers = new Map();

    log.info(
      { windowSize: this.windowSize, flushIntervalMs: this.flushIntervalMs },
      'Trace buffer initialized'
    );
  }

  /**
   * Ingests a new trace event for a student.
   * Triggers a flush when the window is full.
   *
   * @param {string} studentId
   * @param {string} sessionId
   * @param {TraceEvent} traceEvent
   */
  push(studentId, sessionId, traceEvent) {
    const key = `${sessionId}:${studentId}`;
    let buffer = this.buffers.get(key);

    if (!buffer) {
      buffer = {
        events: [],
        flushTimer: null,
        pendingAnalysis: false,
        sessionId,
        studentId,
      };
      this.buffers.set(key, buffer);
    }

    // If there's already an analysis in flight, don't accumulate
    // (prevents queueing up calls that would overwhelm the AI)
    if (buffer.pendingAnalysis) {
      log.debug({ studentId }, 'Skipping trace — analysis already in flight');
      return;
    }

    buffer.events.push(traceEvent);

    // Start timer on first event in this window
    if (buffer.events.length === 1) {
      buffer.flushTimer = setTimeout(() => {
        this._flush(key);
      }, this.flushIntervalMs);
    }

    // Flush immediately if window is full
    if (buffer.events.length >= this.windowSize) {
      this._flush(key);
    }
  }

  /**
   * Aggregates buffered events and triggers the onFlush callback.
   * @param {string} key - Buffer key (sessionId:studentId)
   * @private
   */
  async _flush(key) {
    const buffer = this.buffers.get(key);
    if (!buffer || buffer.events.length === 0) return;

    // Clear the timer to prevent double-flush
    if (buffer.flushTimer) {
      clearTimeout(buffer.flushTimer);
      buffer.flushTimer = null;
    }

    // Snapshot and clear the events
    const events = [...buffer.events];
    buffer.events = [];
    buffer.pendingAnalysis = true;

    // Aggregate the window into a single metrics object
    const aggregated = this._aggregate(events);

    log.debug(
      { studentId: buffer.studentId, eventCount: events.length, avgWpm: aggregated.wpm },
      'Flushing trace buffer'
    );

    try {
      await this.onFlush(buffer.studentId, buffer.sessionId, aggregated);
    } catch (error) {
      log.error(
        { err: error, studentId: buffer.studentId },
        'Error in flush callback'
      );
    } finally {
      buffer.pendingAnalysis = false;
    }
  }

  /**
   * Aggregates a window of trace events into a single metrics payload.
   * Uses statistical aggregation to give the AI meaningful data.
   *
   * @param {TraceEvent[]} events
   * @returns {Object} Aggregated window metrics
   * @private
   */
  _aggregate(events) {
    const n = events.length;

    return {
      wpm: Math.round(events.reduce((sum, e) => sum + e.wpm, 0) / n),
      pauseDurationMs: Math.max(...events.map((e) => e.pauseDurationMs)),
      deletionCount: events.reduce((sum, e) => sum + e.deletionCount, 0),
      keystrokeCount: events.reduce((sum, e) => sum + e.keystrokeCount, 0),
      pasteCount: events.reduce((sum, e) => sum + (e.pasteCount || 0), 0),
      textSnapshot: events[n - 1].textSnapshot, // Latest snapshot
      windowSizeMs: events[n - 1].timestamp - events[0].timestamp,
      eventCount: n,
    };
  }

  /**
   * Removes all buffers for a student (on disconnect).
   * @param {string} studentId
   * @param {string} sessionId
   */
  removeStudent(studentId, sessionId) {
    const key = `${sessionId}:${studentId}`;
    const buffer = this.buffers.get(key);
    if (buffer?.flushTimer) {
      clearTimeout(buffer.flushTimer);
    }
    this.buffers.delete(key);
    log.debug({ studentId }, 'Student buffer removed');
  }

  /**
   * Destroys all buffers and timers (server shutdown).
   */
  destroy() {
    for (const [, buffer] of this.buffers) {
      if (buffer.flushTimer) clearTimeout(buffer.flushTimer);
    }
    this.buffers.clear();
    log.info('All trace buffers destroyed');
  }

  /**
   * Returns buffer statistics for monitoring.
   * @returns {Object}
   */
  getStats() {
    let totalEvents = 0;
    let pendingCount = 0;
    for (const [, buffer] of this.buffers) {
      totalEvents += buffer.events.length;
      if (buffer.pendingAnalysis) pendingCount++;
    }
    return {
      activeBuffers: this.buffers.size,
      totalPendingEvents: totalEvents,
      pendingAnalysis: pendingCount,
    };
  }
}
