// ============================================
// Synaptic Room — Session Repository (Supabase)
// ============================================
// Persistence adapter for sessions and events.
// Stores session metadata and significant events
// (mentorship creations, state changes) for
// post-class analytics.
//
// ARCHITECTURE NOTE: This is an optional persistence
// layer. The core system works entirely in-memory
// via the Session/Student models. Supabase is used
// for historical analytics and audit trail.
// ============================================

import { getSupabaseClient } from '../../config/supabase.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('session-repo');

export class SessionRepository {
  constructor() {
    this.supabase = getSupabaseClient();
    this.enabled = Boolean(this.supabase);
    if (!this.enabled) {
      log.warn('Supabase not configured — persistence disabled, running in-memory only');
    }
  }

  /**
   * Persists a new session record when a teacher creates a room.
   * @param {Object} session
   * @param {string} session.sessionId
   * @param {string} session.teacherId
   * @returns {Promise<Object|null>}
   */
  async createSession({ sessionId, teacherId }) {
    if (!this.enabled) return null;
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .insert({
          id: sessionId,
          teacher_id: teacherId,
          status: 'active',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      log.info({ sessionId }, 'Session persisted to Supabase');
      return data;
    } catch (error) {
      // Non-critical — log and continue (in-memory session still works)
      log.error({ err: error, sessionId }, 'Failed to persist session');
      return null;
    }
  }

  /**
   * Logs a significant cognitive event for analytics.
   * @param {Object} event
   * @param {string} event.sessionId
   * @param {string} event.studentId
   * @param {string} event.eventType - e.g., 'blocked', 'mentorship_start', 'mentorship_end'
   * @param {Object} [event.metadata={}] - Additional data
   * @returns {Promise<void>}
   */
  async logEvent({ sessionId, studentId, eventType, metadata = {} }) {
    if (!this.enabled) return;
    try {
      const { error } = await this.supabase
        .from('cognitive_events')
        .insert({
          session_id: sessionId,
          student_id: studentId,
          event_type: eventType,
          metadata,
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      // Fire-and-forget — analytics failures must never break the real-time flow
      log.warn({ err: error, sessionId, eventType }, 'Failed to log event');
    }
  }

  /**
   * Marks a session as ended.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async endSession(sessionId) {
    if (!this.enabled) return;
    try {
      const { error } = await this.supabase
        .from('sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
      log.info({ sessionId }, 'Session marked as ended');
    } catch (error) {
      log.error({ err: error, sessionId }, 'Failed to end session');
    }
  }

  /**
   * Persists a new mentorship record when a micro-mentorship is created.
   * @param {import('../../domain/models/Mentorship.js').Mentorship} mentorship
   * @returns {Promise<void>}
   */
  async saveMentorship(mentorship) {
    if (!this.enabled) return;
    try {
      const { error } = await this.supabase
        .from('mentorships')
        .insert({
          id: mentorship.mentorshipId,
          session_id: mentorship.sessionId,
          mentor_id: mentorship.mentorId,
          mentor_name: mentorship.mentorName,
          mentee_id: mentorship.menteeId,
          mentee_name: mentorship.menteeName,
          topic: mentorship.topic,
          status: 'active',
          created_at: new Date(mentorship.createdAt).toISOString(),
        });

      if (error) throw error;
      log.info({ mentorshipId: mentorship.mentorshipId }, 'Mentorship persisted to Supabase');
    } catch (error) {
      // Non-critical — analytics must never break the real-time flow
      log.warn({ err: error, mentorshipId: mentorship.mentorshipId }, 'Failed to save mentorship');
    }
  }

  /**
   * Updates a mentorship record when it is closed.
   * @param {string} mentorshipId
   * @param {'completed' | 'expired' | 'cancelled'} status
   * @param {number} durationMs - How long the mentorship lasted
   * @returns {Promise<void>}
   */
  async closeMentorship(mentorshipId, status, durationMs) {
    if (!this.enabled) return;
    try {
      const { error } = await this.supabase
        .from('mentorships')
        .update({
          status,
          ended_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', mentorshipId);

      if (error) throw error;
      log.info({ mentorshipId, status, durationMs }, 'Mentorship record closed in Supabase');
    } catch (error) {
      log.warn({ err: error, mentorshipId }, 'Failed to close mentorship record');
    }
  }
}
