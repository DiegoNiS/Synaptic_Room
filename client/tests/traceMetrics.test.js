// ============================================
// Tests — Client trace metric aggregation (pure)
// ============================================
// Pins the tracker's core math (WPM, pause, payload shape) that feeds the
// server rule engine. Traceability: P0-R-005 · verifies P0-AC-005 · task P0-T-010.
// ============================================

import { describe, it, expect } from 'vitest';
import {
  computeWpm,
  computePauseDuration,
  computeWindowMetrics,
} from '../src/lib/traceMetrics.js';

describe('computeWpm', () => {
  it('uses the 5-chars-per-word convention', () => {
    // 100 keystrokes over 60s => 20 "words" per minute.
    expect(computeWpm(100, 60000)).toBe(20);
  });

  it('returns 0 for zero elapsed time or zero keystrokes', () => {
    expect(computeWpm(50, 0)).toBe(0);
    expect(computeWpm(0, 60000)).toBe(0);
  });
});

describe('computePauseDuration', () => {
  it('takes the larger of max mid-window pause and trailing idle', () => {
    expect(computePauseDuration(2000, 5000)).toBe(5000);
    expect(computePauseDuration(8000, 1000)).toBe(8000);
  });
});

describe('computeWindowMetrics', () => {
  it('produces the full payload with safe defaults', () => {
    const m = computeWindowMetrics({
      keystrokes: 50,
      deletions: 10,
      pasteCount: 0,
      maxPauseMs: 1200,
      idleMs: 300,
      elapsedMs: 30000,
      textSnapshot: 'hola',
    });
    expect(m).toEqual({
      wpm: 20, // 50 keystrokes / 5 over 0.5min
      pauseDurationMs: 1200,
      deletionCount: 10,
      keystrokeCount: 50,
      pasteCount: 0,
      textSnapshot: 'hola',
    });
  });

  it('handles an empty/partial state without throwing', () => {
    const m = computeWindowMetrics({});
    expect(m.wpm).toBe(0);
    expect(m.textSnapshot).toBe('');
    expect(m.keystrokeCount).toBe(0);
  });
});
