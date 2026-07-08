// ============================================
// Synaptic Room — Environment Configuration
// ============================================
// Single, fail-fast source of truth for all runtime configuration.
//
// Security posture (NN-4 — secure by default):
//   The server REFUSES to start unless the authentication secrets are present:
//     - JOIN_TOKEN_SECRET   (signs/verifies socket join tokens)
//     - AGENT_API_KEY       (authenticates the server → AI agents channel)
//     - TEACHER_PASSCODE    (gates the privileged teacher role)
//   There is NO silent "dev mode without auth". The only way to run without
//   these is to set NEXORA_DEV_INSECURE=true EXPLICITLY, which is loud and is
//   hard-forbidden in production.
//
// Traceability: P0-R-001, P0-R-002, P0-R-003 · design P0-D-001.
// ============================================

import dotenv from 'dotenv';
import path from 'path';
import { parseEnv, FieldType, EnvValidationError } from './envSchema.js';

// In a monorepo the root .env is the single source of truth; a local .env may
// override it when the server is run in isolation.
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

// ── Resolve execution mode BEFORE building the schema ──
// (Whether the auth secrets are "required" depends on the mode.)
const NODE_ENV = (process.env.NODE_ENV || 'development').trim();
const IS_PROD = NODE_ENV === 'production';

const INSECURE_REQUESTED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.NEXORA_DEV_INSECURE || '')
    .trim()
    .toLowerCase()
);

// P0-R-002: the insecure escape hatch is forbidden in production. Fail hard and
// early — before any secret-optional schema could weaken the posture.
if (IS_PROD && INSECURE_REQUESTED) {
  console.error(
    '[ENV] FATAL: NEXORA_DEV_INSECURE cannot be enabled while NODE_ENV=production. ' +
      'Provide real secrets (JOIN_TOKEN_SECRET, AGENT_API_KEY, TEACHER_PASSCODE) instead.'
  );
  process.exit(1);
}

/** True only when running WITHOUT auth by explicit developer opt-in (never in prod). */
const INSECURE_MODE = INSECURE_REQUESTED && !IS_PROD;

// Auth secrets are required unless the developer explicitly opted into insecure mode.
const SECRET_REQUIRED = !INSECURE_MODE;

/**
 * The full configuration schema. Field order here is also the order issues are
 * reported, so keep the security-critical secrets first.
 */
const SCHEMA = {
  // ── Runtime ──
  NODE_ENV: {
    type: FieldType.ENUM,
    values: ['development', 'test', 'production'],
    default: 'development',
    description: 'Runtime environment',
  },
  PORT: { type: FieldType.INT, default: 3001, min: 1, max: 65535 },

  // ── Auth secrets (secure-by-default: required unless NEXORA_DEV_INSECURE) ──
  JOIN_TOKEN_SECRET: {
    type: FieldType.STRING,
    required: SECRET_REQUIRED,
    secret: true,
    min: 16,
    description: 'HMAC secret for socket join tokens. Generate with: openssl rand -hex 32',
  },
  AGENT_API_KEY: {
    type: FieldType.STRING,
    required: SECRET_REQUIRED,
    secret: true,
    min: 16,
    description:
      'Shared secret authenticating the server → AI agents channel. Must match the agents service.',
  },
  TEACHER_PASSCODE: {
    type: FieldType.STRING,
    required: SECRET_REQUIRED,
    secret: true,
    min: 6,
    description: 'Passcode gating the privileged teacher role.',
  },

  // ── AI Agent (FastAPI) ──
  AI_AGENT_BASE_URL: { type: FieldType.URL, default: 'http://localhost:8000' },
  AI_AGENT_TIMEOUT_MS: { type: FieldType.INT, default: 15000, min: 1000, max: 120000 },
  AI_AGENT_MAX_RETRIES: { type: FieldType.INT, default: 2, min: 0, max: 10 },

  // ── CORS ──
  CORS_ORIGIN: { type: FieldType.URL, default: 'http://localhost:5173' },

  // ── Durable hot state (Redis) ──
  // Absent = in-memory state (single instance / dev). Set for durability + horizontal scale.
  REDIS_URL: {
    type: FieldType.STRING,
    required: false,
    description: 'Redis connection URL (redis://host:port). Enables durable, shared hot state.',
  },
  STATE_HOT_TTL_S: { type: FieldType.INT, default: 7200, min: 60, max: 86400 },

  // ── Supabase (optional: absent = in-memory persistence, NOT a mock) ──
  SUPABASE_URL: { type: FieldType.URL, required: false, description: 'Supabase project URL' },
  SUPABASE_ANON_KEY: { type: FieldType.STRING, required: false, secret: true },
  SUPABASE_SERVICE_ROLE_KEY: { type: FieldType.STRING, required: false, secret: true },

  // ── Circuit Breaker ──
  CB_FAILURE_THRESHOLD: { type: FieldType.INT, default: 5, min: 1, max: 100 },
  CB_RESET_TIMEOUT_MS: { type: FieldType.INT, default: 30000, min: 1000, max: 600000 },

  // ── Trace Buffer ──
  TRACE_BUFFER_WINDOW_SIZE: { type: FieldType.INT, default: 5, min: 1, max: 1000 },
  TRACE_BUFFER_FLUSH_INTERVAL_MS: { type: FieldType.INT, default: 3000, min: 250, max: 60000 },
};

let parsed;
try {
  parsed = parseEnv(SCHEMA, process.env);
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(`[ENV] FATAL: ${err.message}\n`);
    if (!IS_PROD) {
      console.error(
        '[ENV] For local development without auth you may set NEXORA_DEV_INSECURE=true ' +
          '(never in production).'
      );
    }
    process.exit(1);
  }
  throw err;
}

const { values, secretKeys } = parsed;

// Supabase is enabled only when both URL and the service-role key are present.
const SUPABASE_ENABLED = Boolean(values.SUPABASE_URL && values.SUPABASE_SERVICE_ROLE_KEY);

/**
 * @typedef {Object} EnvConfig
 * @property {number} PORT
 * @property {'development'|'test'|'production'} NODE_ENV
 * @property {boolean} IS_PROD
 * @property {boolean} INSECURE_MODE
 * @property {boolean} SUPABASE_ENABLED
 * @property {string|null} SUPABASE_URL
 * @property {string|null} SUPABASE_ANON_KEY
 * @property {string|null} SUPABASE_SERVICE_ROLE_KEY
 * @property {string} AI_AGENT_BASE_URL
 * @property {number} AI_AGENT_TIMEOUT_MS
 * @property {number} AI_AGENT_MAX_RETRIES
 * @property {string|null} AGENT_API_KEY
 * @property {string|null} JOIN_TOKEN_SECRET
 * @property {string|null} TEACHER_PASSCODE
 * @property {string} CORS_ORIGIN
 * @property {number} CB_FAILURE_THRESHOLD
 * @property {number} CB_RESET_TIMEOUT_MS
 * @property {number} TRACE_BUFFER_WINDOW_SIZE
 * @property {number} TRACE_BUFFER_FLUSH_INTERVAL_MS
 */

/** @type {Readonly<EnvConfig>} */
export const env = Object.freeze({
  ...values,
  IS_PROD,
  INSECURE_MODE,
  SUPABASE_ENABLED,
});

/**
 * Canonical list of secret-bearing env keys, for log redaction (single source
 * of truth consumed by the logger). Never log these values.
 * @type {readonly string[]}
 */
export const SECRET_ENV_KEYS = Object.freeze(secretKeys);
