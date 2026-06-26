// ============================================
// Synaptic Room — Supabase Client
// ============================================
// Singleton Supabase client for session persistence
// and event logging. Used by the SessionRepository.
//
// SECURITY NOTE: This client uses the SERVICE_ROLE key,
// which bypasses Row Level Security (RLS). This is safe
// because this code runs ONLY on the backend server —
// the key is never exposed to the browser.
// The anon key remains available for any future
// read-only or frontend-proxied queries.
// ============================================

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/** @type {import('@supabase/supabase-js').SupabaseClient} */
let supabaseClient = null;

/**
 * Returns a singleton Supabase client instance.
 * Uses the service_role key to bypass RLS for server-side writes.
 * Lazy-initialized to avoid import-order issues.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Disable realtime — we use Socket.io for that
      realtime: { params: { eventsPerSecond: 10 } },
    });
    logger.info({ component: 'supabase' }, 'Supabase client initialized (service_role)');
  }
  return supabaseClient;
}
