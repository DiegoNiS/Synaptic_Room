// ============================================
// Tests — Local Rule Engine (heuristic classification)
// ============================================
// The local rule engine resolves ~95% of events without calling the AI. It is
// an efficiency layer, NOT a replacement for AI diagnosis (NN-3): it only
// decides WHEN to escalate to the AI (state === 'blocked'). This suite pins its
// classification behavior so refactors and threshold tweaks stay honest.
// Traceability: P0-R-005 · verifies P0-AC-005 · task P0-T-008.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TraceAnalysisUseCase } from '../../src/application/TraceAnalysisUseCase.js';

// The rule engine is pure: it needs no wired dependencies to classify.
const engine = new TraceAnalysisUseCase({
  agentClient: null,
  sessionRepository: null,
  activeSessions: null,
  mentorshipUseCase: null,
  io: null,
});

const classify = (metrics, backspaceRatio) => engine._classifyLocally(metrics, backspaceRatio);

test('pasted code is flagged as fraud with high confidence', () => {
  const r = classify({ wpm: 40, pauseDurationMs: 0, pasteCount: 1 }, 0);
  assert.equal(r.state, 'fraude');
  assert.ok(r.confidence >= 0.95);
});

test('steady typing with low deletion → flow', () => {
  const r = classify({ wpm: 30, pauseDurationMs: 0, pasteCount: 0 }, 0.05);
  assert.equal(r.state, 'flow');
});

test('very low WPM + high deletion ratio → blocked (escalates to AI)', () => {
  const r = classify({ wpm: 2, pauseDurationMs: 1000, pasteCount: 0 }, 0.5);
  assert.equal(r.state, 'blocked');
});

test('long pause → blocked', () => {
  const r = classify({ wpm: 8, pauseDurationMs: 9000, pasteCount: 0 }, 0.1);
  assert.equal(r.state, 'blocked');
});

test('ambiguous middle ground → idle (no AI call)', () => {
  const r = classify({ wpm: 7, pauseDurationMs: 1000, pasteCount: 0 }, 0.2);
  assert.equal(r.state, 'idle');
});

test('blockage-point sanitization flattens, bounds and rejects empties (anti prompt-injection)', () => {
  assert.equal(engine._sanitizeBlockagePoint(null), null);
  assert.equal(engine._sanitizeBlockagePoint('   '), null);
  assert.equal(engine._sanitizeBlockagePoint('line1\n\nline2\t  x'), 'line1 line2 x');
  const long = 'a'.repeat(500);
  assert.equal(engine._sanitizeBlockagePoint(long).length, 160);
});
