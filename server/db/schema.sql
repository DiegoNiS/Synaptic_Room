-- ============================================
-- Synaptic Room — Supabase Database Schema
-- ============================================
-- Execute this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → Paste → Run
--
-- This creates the 3 tables used by SessionRepository.js:
--   1. sessions         — Classroom session records
--   2. cognitive_events — Audit trail of state changes
--   3. mentorships      — Micro-mentorship lifecycle records
--
-- ARCHITECTURE NOTE: These tables are for historical
-- analytics only. The real-time system runs entirely
-- in-memory via Session/Student domain models.
-- ============================================

-- 0. Limpiar tablas antiguas si existen (para corregir errores previos)
DROP TABLE IF EXISTS public.mentorships CASCADE;
DROP TABLE IF EXISTS public.cognitive_events CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;

-- ────────────────────────────────────────────
-- 1. SESSIONS
-- ────────────────────────────────────────────
-- One row per classroom session (teacher creates a room).
-- Status transitions: 'active' → 'ended'
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  teacher_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'ended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ
);

COMMENT ON TABLE sessions IS 'Classroom session records for post-class analytics.';


-- ────────────────────────────────────────────
-- 2. COGNITIVE EVENTS
-- ────────────────────────────────────────────
-- Audit log of significant cognitive state changes.
-- event_type examples: 'blocked', 'mentorship_start',
--   'mentorship_end', 'state_change'
-- metadata stores context as flexible JSONB.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cognitive_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cognitive_events IS 'Audit trail of cognitive state changes for analytics.';

-- Index: fast lookups by session (teacher reviewing a class)
CREATE INDEX IF NOT EXISTS idx_cognitive_events_session
  ON cognitive_events(session_id);

-- Index: filter events by type within a session
CREATE INDEX IF NOT EXISTS idx_cognitive_events_session_type
  ON cognitive_events(session_id, event_type);

-- Index: find all events for a specific student
CREATE INDEX IF NOT EXISTS idx_cognitive_events_student
  ON cognitive_events(student_id);


-- ────────────────────────────────────────────
-- 3. MENTORSHIPS
-- ────────────────────────────────────────────
-- Records each micro-mentorship pairing lifecycle.
-- Status transitions: 'active' → 'completed' | 'expired' | 'cancelled'
-- duration_ms is computed on close by the server.
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentorships (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  mentor_id     TEXT NOT NULL,
  mentor_name   TEXT NOT NULL,
  mentee_id     TEXT NOT NULL,
  mentee_name   TEXT NOT NULL,
  topic         TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

COMMENT ON TABLE mentorships IS 'Micro-mentorship lifecycle records.';

-- Index: find all mentorships in a session (teacher analytics)
CREATE INDEX IF NOT EXISTS idx_mentorships_session
  ON mentorships(session_id);

-- Index: find mentorships by mentor or mentee
CREATE INDEX IF NOT EXISTS idx_mentorships_mentor
  ON mentorships(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentorships_mentee
  ON mentorships(mentee_id);

-- Index: filter active mentorships quickly
CREATE INDEX IF NOT EXISTS idx_mentorships_status
  ON mentorships(status)
  WHERE status = 'active';


-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables. Since the backend uses
-- the service_role key, it bypasses RLS entirely.
-- This protects data if anyone tries to use the
-- anon key directly from the frontend.
-- ============================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service_role full access (backend server)
-- The service_role key automatically bypasses RLS,
-- so these policies effectively block anon access
-- while letting the backend operate freely.

-- All policies for 'anon' have been removed to secure the database.
-- By default, when RLS is enabled and no policies exist, all access is denied.
-- The Node.js backend uses SUPABASE_SERVICE_ROLE_KEY, which automatically
-- bypasses RLS, so it will continue to work perfectly while keeping your data safe from the public.


-- ============================================
-- DONE
-- ============================================
-- After running this script, verify by running:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public';
-- ============================================
