// ============================================
// Synaptic Room — Environment Configuration
// ============================================
// Validates and exports all environment variables at startup.
// Fails fast if any required variable is missing — prevents
// silent runtime errors in production.
// ============================================

import 'dotenv/config';

/**
 * @typedef {Object} EnvConfig
 * @property {number} PORT
 * @property {string} NODE_ENV
 * @property {string} SUPABASE_URL
 * @property {string} SUPABASE_ANON_KEY
 * @property {string} AI_AGENT_BASE_URL
 * @property {number} AI_AGENT_TIMEOUT_MS
 * @property {number} AI_AGENT_MAX_RETRIES
 * @property {string} CORS_ORIGIN
 * @property {number} CB_FAILURE_THRESHOLD
 * @property {number} CB_RESET_TIMEOUT_MS
 * @property {number} TRACE_BUFFER_WINDOW_SIZE
 * @property {number} TRACE_BUFFER_FLUSH_INTERVAL_MS
 */

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

/**
 * Validates that all required environment variables are present.
 * Throws a descriptive error listing all missing vars at once.
 */
function validateEnv() {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}`
    );
  }
}

validateEnv();

/** @type {EnvConfig} */
export const env = Object.freeze({
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,

  // AI Agent (Diego's FastAPI)
  AI_AGENT_BASE_URL: process.env.AI_AGENT_BASE_URL || 'http://localhost:8000',
  AI_AGENT_TIMEOUT_MS: parseInt(process.env.AI_AGENT_TIMEOUT_MS || '2000', 10),
  AI_AGENT_MAX_RETRIES: parseInt(process.env.AI_AGENT_MAX_RETRIES || '3', 10),

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Circuit Breaker
  CB_FAILURE_THRESHOLD: parseInt(process.env.CB_FAILURE_THRESHOLD || '5', 10),
  CB_RESET_TIMEOUT_MS: parseInt(process.env.CB_RESET_TIMEOUT_MS || '30000', 10),

  // Trace Buffer
  TRACE_BUFFER_WINDOW_SIZE: parseInt(process.env.TRACE_BUFFER_WINDOW_SIZE || '5', 10),
  TRACE_BUFFER_FLUSH_INTERVAL_MS: parseInt(process.env.TRACE_BUFFER_FLUSH_INTERVAL_MS || '3000', 10),
});
