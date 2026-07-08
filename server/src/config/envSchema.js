// ============================================
// Synaptic Room — Environment Schema Validator
// ============================================
// A tiny, dependency-free, fail-fast schema validator purpose-built for the
// configuration bootstrap layer.
//
// Why not zod/envalid here? This module is the *very first* thing that loads,
// before any dependency graph is wired. Keeping it dependency-free removes a
// class of "config failed because a dependency failed to import" problems and
// gives us full control over secret redaction and error aggregation.
//
// Design goals:
//   - Fail fast: collect EVERY problem and throw ONCE with an actionable report,
//     instead of failing on the first missing variable.
//   - Typed coercion: string | int | bool | enum | url, with bounds.
//   - Secret-aware: fields flagged `secret: true` are never echoed in error
//     messages or logs (only their presence/length is reported).
//   - Pure: no side effects, no process.exit here — the caller decides how to
//     react (env.js exits; tests assert on the thrown error).
// ============================================

/**
 * Error thrown when one or more environment variables fail validation.
 * Aggregates all issues so operators fix everything in a single pass.
 */
export class EnvValidationError extends Error {
  /**
   * @param {string[]} issues - Human-readable, secret-safe problem descriptions.
   */
  constructor(issues) {
    const body = issues.map((i) => `  • ${i}`).join('\n');
    super(
      `Invalid environment configuration (${issues.length} issue${issues.length === 1 ? '' : 's'}):\n${body}`
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Supported field types.
 * @readonly
 */
export const FieldType = Object.freeze({
  STRING: 'string',
  INT: 'int',
  BOOL: 'bool',
  ENUM: 'enum',
  URL: 'url',
});

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', '']);

/**
 * @typedef {Object} FieldSpec
 * @property {string} type                 One of FieldType.
 * @property {boolean} [required]          Whether the variable must be present & non-empty.
 * @property {*} [default]                 Default applied when absent (only if not required).
 * @property {boolean} [secret]            If true, the value is never echoed in errors/logs.
 * @property {number} [min]                For INT: minimum; for STRING: min length.
 * @property {number} [max]                For INT: maximum; for STRING: max length.
 * @property {string[]} [values]           For ENUM: the allowed set.
 * @property {string} [description]        Documentation, surfaced in error hints.
 */

/**
 * Coerces and validates a single raw value against a field spec.
 * @param {string} key
 * @param {string|undefined} raw
 * @param {FieldSpec} spec
 * @returns {{ ok: true, value: * } | { ok: false, issue: string }}
 */
function coerceField(key, raw, spec) {
  const present = raw !== undefined && raw !== null && String(raw).trim() !== '';

  if (!present) {
    if (spec.required) {
      const hint = spec.description ? ` — ${spec.description}` : '';
      return { ok: false, issue: `${key} is required but missing${hint}` };
    }
    return { ok: true, value: spec.default ?? null };
  }

  const value = String(raw).trim();

  switch (spec.type) {
    case FieldType.STRING: {
      if (spec.min !== undefined && value.length < spec.min) {
        return { ok: false, issue: `${key} must be at least ${spec.min} characters long` };
      }
      if (spec.max !== undefined && value.length > spec.max) {
        return { ok: false, issue: `${key} must be at most ${spec.max} characters long` };
      }
      return { ok: true, value };
    }

    case FieldType.INT: {
      if (!/^-?\d+$/.test(value)) {
        return { ok: false, issue: `${key} must be an integer (got a non-numeric value)` };
      }
      const n = Number.parseInt(value, 10);
      if (spec.min !== undefined && n < spec.min) {
        return { ok: false, issue: `${key} must be >= ${spec.min}` };
      }
      if (spec.max !== undefined && n > spec.max) {
        return { ok: false, issue: `${key} must be <= ${spec.max}` };
      }
      return { ok: true, value: n };
    }

    case FieldType.BOOL: {
      const lowered = value.toLowerCase();
      if (TRUE_VALUES.has(lowered)) return { ok: true, value: true };
      if (FALSE_VALUES.has(lowered)) return { ok: true, value: false };
      return { ok: false, issue: `${key} must be a boolean (true/false/1/0/yes/no)` };
    }

    case FieldType.ENUM: {
      if (!spec.values || !spec.values.includes(value)) {
        return { ok: false, issue: `${key} must be one of: ${(spec.values || []).join(', ')}` };
      }
      return { ok: true, value };
    }

    case FieldType.URL: {
      try {
        new URL(value);
        return { ok: true, value };
      } catch {
        return { ok: false, issue: `${key} must be a valid URL` };
      }
    }

    default:
      return { ok: false, issue: `${key} has an unknown field type "${spec.type}"` };
  }
}

/**
 * Parses a raw environment object against a schema, failing fast with an
 * aggregated {@link EnvValidationError} listing every problem at once.
 *
 * @param {Record<string, FieldSpec>} schema
 * @param {Record<string, string|undefined>} [rawEnv=process.env]
 * @returns {{ values: Record<string, *>, secretKeys: string[] }}
 * @throws {EnvValidationError}
 */
export function parseEnv(schema, rawEnv = process.env) {
  /** @type {Record<string, *>} */
  const values = {};
  /** @type {string[]} */
  const issues = [];
  /** @type {string[]} */
  const secretKeys = [];

  for (const [key, spec] of Object.entries(schema)) {
    if (spec.secret) secretKeys.push(key);

    const result = coerceField(key, rawEnv[key], spec);
    if (result.ok) {
      values[key] = result.value;
    } else {
      issues.push(result.issue);
    }
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return { values, secretKeys };
}
