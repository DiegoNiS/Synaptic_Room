// ============================================
// Tests — Logger Secret Redaction
// ============================================
// Asserts that the redaction policy exported by the logger actually censors
// secret-bearing fields, so secrets never reach log sinks.
// Traceability: P0-R-003 · verifies P0-AC-003.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';
import { REDACT_PATHS } from '../../src/utils/logger.js';

// Build a logger with the REAL redaction policy, writing to an in-memory sink.
function makeSink() {
  const lines = [];
  const stream = { write: (chunk) => lines.push(chunk) };
  const log = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { log, lines };
}

test('censors top-level secret fields', () => {
  const { log, lines } = makeSink();
  log.info(
    { JOIN_TOKEN_SECRET: 'super-secret', AGENT_API_KEY: 'key-123', TEACHER_PASSCODE: 'pc' },
    'boot'
  );
  const out = lines.join('');
  assert.ok(!out.includes('super-secret'));
  assert.ok(!out.includes('key-123'));
  assert.match(out, /\[REDACTED\]/);
});

test('censors nested secrets one level deep (e.g. env.*)', () => {
  const { log, lines } = makeSink();
  log.info({ env: { JOIN_TOKEN_SECRET: 'nested-secret' } }, 'config');
  const out = lines.join('');
  assert.ok(!out.includes('nested-secret'));
});

test('censors tokens, passcodes and authorization headers', () => {
  const { log, lines } = makeSink();
  log.info(
    { token: 'jwt-abc', passcode: 'p4ss', req: { headers: { authorization: 'Bearer xyz' } } },
    'req'
  );
  const out = lines.join('');
  assert.ok(!out.includes('jwt-abc'));
  assert.ok(!out.includes('p4ss'));
  assert.ok(!out.includes('Bearer xyz'));
});
