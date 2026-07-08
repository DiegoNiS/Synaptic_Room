// ============================================
// Synaptic Room — Trace metric aggregation (pure)
// ============================================
// Pure functions for turning raw keystroke counters into the window metrics the
// server's rule engine consumes. Extracted from useTracker so the math is unit-
// testable without React, timers, or the DOM.
// ============================================

/**
 * @typedef {Object} RawTraceState
 * @property {number} keystrokes    Keystrokes recorded in the window.
 * @property {number} deletions     Deletion keystrokes in the window.
 * @property {number} pasteCount    Paste events in the window.
 * @property {number} maxPauseMs    Longest inter-keystroke pause observed.
 * @property {number} idleMs        Time since the last keystroke at flush.
 * @property {number} elapsedMs     Window duration.
 * @property {string} textSnapshot  Current combined text.
 */

/**
 * Words-per-minute using the standard "5 chars = 1 word" convention.
 * @param {number} keystrokes
 * @param {number} elapsedMs
 * @returns {number} Non-negative integer WPM.
 */
export function computeWpm(keystrokes, elapsedMs) {
  const elapsedMinutes = elapsedMs / 60000;
  if (elapsedMinutes <= 0 || keystrokes <= 0) return 0;
  return Math.max(0, Math.round(keystrokes / 5 / elapsedMinutes));
}

/**
 * The effective pause is the larger of the longest mid-window pause and the
 * trailing idle time (a student who simply stopped typing).
 * @param {number} maxPauseMs
 * @param {number} idleMs
 * @returns {number}
 */
export function computePauseDuration(maxPauseMs, idleMs) {
  return Math.round(Math.max(maxPauseMs || 0, idleMs || 0));
}

/**
 * Builds the window-metrics payload emitted to the server each flush interval.
 * @param {RawTraceState} state
 * @returns {{ wpm:number, pauseDurationMs:number, deletionCount:number,
 *   keystrokeCount:number, pasteCount:number, textSnapshot:string }}
 */
export function computeWindowMetrics(state) {
  const {
    keystrokes = 0,
    deletions = 0,
    pasteCount = 0,
    maxPauseMs = 0,
    idleMs = 0,
    elapsedMs = 0,
    textSnapshot = '',
  } = state || {};

  return {
    wpm: computeWpm(keystrokes, elapsedMs),
    pauseDurationMs: computePauseDuration(maxPauseMs, idleMs),
    deletionCount: deletions,
    keystrokeCount: keystrokes,
    pasteCount,
    textSnapshot: textSnapshot || '',
  };
}
