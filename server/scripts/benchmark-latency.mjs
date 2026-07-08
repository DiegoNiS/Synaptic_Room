// ============================================
// Synaptic Room — Local classification latency benchmark
// ============================================
// The real-time budget (P1-R-005 / P1-AC-006): the local rule-engine path
// tracker → classification must stay well under 300 ms p95. The AI diagnosis is
// asynchronous and off the critical path, so it is intentionally NOT measured
// here. Exits non-zero if the budget is exceeded (usable as a CI perf gate).
//
// Run: node scripts/benchmark-latency.mjs
// ============================================

import { TraceAnalysisUseCase } from '../src/application/TraceAnalysisUseCase.js';

const BUDGET_P95_MS = 300;
const ITERATIONS = 200_000;

const engine = new TraceAnalysisUseCase({
  agentClient: null,
  sessionRepository: null,
  activeSessions: null,
  mentorshipUseCase: null,
  io: null,
});

// A representative spread of window metrics (flow / idle / blocked / fraud).
const samples = [
  { m: { wpm: 30, pauseDurationMs: 200, pasteCount: 0 }, b: 0.05 },
  { m: { wpm: 7, pauseDurationMs: 1000, pasteCount: 0 }, b: 0.2 },
  { m: { wpm: 2, pauseDurationMs: 9000, pasteCount: 0 }, b: 0.5 },
  { m: { wpm: 40, pauseDurationMs: 0, pasteCount: 1 }, b: 0 },
];

const durations = new Float64Array(ITERATIONS);
for (let i = 0; i < ITERATIONS; i++) {
  const s = samples[i % samples.length];
  const t0 = process.hrtime.bigint();
  engine._classifyLocally(s.m, s.b);
  const t1 = process.hrtime.bigint();
  durations[i] = Number(t1 - t0) / 1e6; // ms
}

durations.sort();
const pct = (p) => durations[Math.min(ITERATIONS - 1, Math.floor((p / 100) * ITERATIONS))];
const p50 = pct(50);
const p95 = pct(95);
const p99 = pct(99);
const mean = durations.reduce((a, b) => a + b, 0) / ITERATIONS;

console.log('Local classification latency (rule engine):');
console.log(`  iterations : ${ITERATIONS.toLocaleString()}`);
console.log(`  mean       : ${mean.toFixed(5)} ms`);
console.log(`  p50        : ${p50.toFixed(5)} ms`);
console.log(`  p95        : ${p95.toFixed(5)} ms   (budget ${BUDGET_P95_MS} ms)`);
console.log(`  p99        : ${p99.toFixed(5)} ms`);

if (p95 > BUDGET_P95_MS) {
  console.error(`\n[FAIL] p95 ${p95.toFixed(3)} ms exceeds the ${BUDGET_P95_MS} ms budget`);
  process.exit(1);
}
console.log(
  `\n[OK] p95 within budget (${((p95 / BUDGET_P95_MS) * 100).toFixed(3)}% of ${BUDGET_P95_MS} ms).`
);
