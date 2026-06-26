// ============================================
// Synaptic Room — Supabase Client
// ============================================
// Singleton Supabase client for session persistence
// and event logging. Used by the SessionRepository.
// ============================================

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/** @type {import('@supabase/supabase-js').SupabaseClient} */
let supabaseClient = null;

/**
 * Returns a singleton Supabase client instance.
 * Lazy-initialized to avoid import-order issues.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    logger.info({ component: 'supabase' }, 'Supabase client initialized');
  }
  return supabaseClient;
}
