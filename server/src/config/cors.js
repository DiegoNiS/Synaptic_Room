// ============================================
// Synaptic Room — CORS Configuration
// ============================================
// Strict CORS policy: only the Frontend origin
// is allowed in production. In development,
// allows localhost variants for convenience.
// ============================================

import { env } from './env.js';

/**
 * Generates CORS options based on the current environment.
 * @returns {import('cors').CorsOptions}
 */
export function getCorsOptions() {
  const allowedOrigins = env.NODE_ENV === 'production'
    ? [env.CORS_ORIGIN]
    : [
        env.CORS_ORIGIN,
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
      ];

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  };
}
