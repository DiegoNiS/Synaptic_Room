// ============================================
// Synaptic Room — Environment Configuration
// ============================================
// Validates and exports all environment variables at startup.
// Fails fast if any required variable is missing — prevents
// silent runtime errors in production.
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// En un monorepo, la "Single Source of Truth" es el .env de la raíz
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
// Fallback al local por si se corre aislado
dotenv.config();

/**
 * @typedef {Object} EnvConfig
 * @property {number} PORT
 * @property {string} NODE_ENV
 * @property {string} SUPABASE_URL
 * @property {string} SUPABASE_ANON_KEY
 * @property {string} SUPABASE_SERVICE_ROLE_KEY
 * @property {string} AI_AGENT_BASE_URL
 * @property {number} AI_AGENT_TIMEOUT_MS
 * @property {number} AI_AGENT_MAX_RETRIES
 * @property {string} CORS_ORIGIN
 * @property {number} CB_FAILURE_THRESHOLD
 * @property {number} CB_RESET_TIMEOUT_MS
 * @property {number} TRACE_BUFFER_WINDOW_SIZE
 * @property {number} TRACE_BUFFER_FLUSH_INTERVAL_MS
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// Supabase is OPTIONAL: when its keys are absent the server runs fully
// in-memory and persistence/analytics become no-ops (see SessionRepository).
const SUPABASE_ENABLED = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Validates environment. Boots in any environment, but refuses to start in
 * PRODUCTION without a join-token secret (otherwise sockets are unauthenticated).
 */
function validateEnv() {
  if (IS_PROD && !process.env.JOIN_TOKEN_SECRET) {
    throw new Error(
      '[ENV] JOIN_TOKEN_SECRET is required in production (socket auth would otherwise be open). ' +
        'Generate one with: openssl rand -hex 32'
    );
  }
}

validateEnv();

/** @type {EnvConfig} */
export const env = Object.freeze({
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV,

  // Supabase (optional)
  SUPABASE_ENABLED,
  SUPABASE_URL: process.env.SUPABASE_URL || null,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || null,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null,

  // AI Agent (FastAPI). Timeout sits above typical Gemini latency (2-5s).
  AI_AGENT_BASE_URL: process.env.AI_AGENT_BASE_URL || 'http://localhost:8000',
  AI_AGENT_TIMEOUT_MS: parseInt(process.env.AI_AGENT_TIMEOUT_MS || '15000', 10),
  AI_AGENT_MAX_RETRIES: parseInt(process.env.AI_AGENT_MAX_RETRIES || '2', 10),
  // Shared secret sent to the agents API (must match its AGENT_API_KEY).
  AGENT_API_KEY: process.env.AGENT_API_KEY || null,

  // Auth
  JOIN_TOKEN_SECRET: process.env.JOIN_TOKEN_SECRET || null,
  TEACHER_PASSCODE: process.env.TEACHER_PASSCODE || null,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Circuit Breaker
  CB_FAILURE_THRESHOLD: parseInt(process.env.CB_FAILURE_THRESHOLD || '5', 10),
  CB_RESET_TIMEOUT_MS: parseInt(process.env.CB_RESET_TIMEOUT_MS || '30000', 10),

  // Trace Buffer
  TRACE_BUFFER_WINDOW_SIZE: parseInt(process.env.TRACE_BUFFER_WINDOW_SIZE || '5', 10),
  TRACE_BUFFER_FLUSH_INTERVAL_MS: parseInt(process.env.TRACE_BUFFER_FLUSH_INTERVAL_MS || '3000', 10),
});
