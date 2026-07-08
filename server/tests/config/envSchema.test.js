// ============================================
// Tests — Environment Schema Validator (unit)
// ============================================
// Verifies fail-fast aggregation, type coercion and bounds.
// Traceability: P0-R-003 · verifies P0-AC-003.
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, FieldType, EnvValidationError } from '../../src/config/envSchema.js';

test('coerces types and applies defaults', () => {
  const schema = {
    PORT: { type: FieldType.INT, default: 3001 },
    FLAG: { type: FieldType.BOOL, default: false },
    MODE: { type: FieldType.ENUM, values: ['a', 'b'], default: 'a' },
    URL: { type: FieldType.URL, default: 'http://localhost' },
    NAME: { type: FieldType.STRING, default: 'x' },
  };
  const { values } = parseEnv(schema, { PORT: '8080', FLAG: 'yes', MODE: 'b' });
  assert.equal(values.PORT, 8080);
  assert.equal(values.FLAG, true);
  assert.equal(values.MODE, 'b');
  assert.equal(values.URL, 'http://localhost'); // default applied
  assert.equal(values.NAME, 'x');
});

test('fails fast and aggregates ALL issues at once', () => {
  const schema = {
    SECRET: { type: FieldType.STRING, required: true, secret: true, min: 16 },
    PORT: { type: FieldType.INT, required: true },
    MODE: { type: FieldType.ENUM, values: ['a', 'b'], required: true },
  };
  try {
    parseEnv(schema, { PORT: 'not-a-number', MODE: 'z' });
    assert.fail('expected EnvValidationError');
  } catch (err) {
    assert.ok(err instanceof EnvValidationError);
    // One issue per bad field: missing SECRET, non-int PORT, bad MODE enum.
    assert.equal(err.issues.length, 3);
  }
});

test('never echoes a secret value in error messages', () => {
  const schema = {
    SECRET: { type: FieldType.STRING, required: true, secret: true, min: 16 },
  };
  try {
    parseEnv(schema, { SECRET: 'too-short' }); // present but violates min length
    assert.fail('expected EnvValidationError');
  } catch (err) {
    assert.ok(err instanceof EnvValidationError);
    assert.ok(!err.message.includes('too-short'), 'secret value must not appear in the error');
  }
});

test('enforces integer bounds', () => {
  const schema = { PORT: { type: FieldType.INT, min: 1, max: 65535 } };
  assert.throws(() => parseEnv(schema, { PORT: '70000' }), EnvValidationError);
  assert.throws(() => parseEnv(schema, { PORT: '0' }), EnvValidationError);
  assert.doesNotThrow(() => parseEnv(schema, { PORT: '3001' }));
});

test('collects the list of secret keys', () => {
  const schema = {
    A: { type: FieldType.STRING, secret: true, default: null },
    B: { type: FieldType.STRING, default: null },
    C: { type: FieldType.STRING, secret: true, default: null },
  };
  const { secretKeys } = parseEnv(schema, {});
  assert.deepEqual(secretKeys.sort(), ['A', 'C']);
});
