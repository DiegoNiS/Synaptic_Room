// ============================================
// Synaptic Room — SessionStateRepository (port)
// ============================================
// The application-layer contract for hot session state (sessions + active
// mentorships). It replaces the raw in-process `Map()` so that state can live
// OUTSIDE the Node process (Redis), surviving restarts and shared across
// instances (P1-R-001/002). The application layer depends ONLY on this port;
// it never imports Redis directly (verifies P0/P1 layering).
//
// All methods are async so a single interface fits both the in-memory adapter
// (dev/single instance) and the Redis adapter (production/horizontal scale).
//
// Traceability: P1-R-001 · design P1-D-001.
// ============================================

/**
 * @typedef {import('../../domain/models/Session.js').Session} Session
 * @typedef {import('../../domain/models/Mentorship.js').Mentorship} Mentorship
 */

/**
 * Abstract port. Concrete adapters MUST implement every method. Instantiating
 * this base class directly is a programming error.
 */
export class SessionStateRepository {
  // ── Sessions ──────────────────────────────────────────────────────────
  /**
   * @param {string} _sessionId
   * @returns {Promise<Session|null>}
   */
  async getSession(_sessionId) {
    throw new Error('SessionStateRepository.getSession() not implemented');
  }

  /**
   * Persist (create or replace) a session.
   * @param {Session} _session
   * @returns {Promise<void>}
   */
  async saveSession(_session) {
    throw new Error('SessionStateRepository.saveSession() not implemented');
  }

  /**
   * @param {string} _sessionId
   * @returns {Promise<void>}
   */
  async deleteSession(_sessionId) {
    throw new Error('SessionStateRepository.deleteSession() not implemented');
  }

  /**
   * @returns {Promise<string[]>} Ids of all live sessions.
   */
  async listSessionIds() {
    throw new Error('SessionStateRepository.listSessionIds() not implemented');
  }

  // ── Mentorships ───────────────────────────────────────────────────────
  /**
   * @param {string} _mentorshipId
   * @returns {Promise<Mentorship|null>}
   */
  async getMentorship(_mentorshipId) {
    throw new Error('SessionStateRepository.getMentorship() not implemented');
  }

  /**
   * @param {Mentorship} _mentorship
   * @returns {Promise<void>}
   */
  async saveMentorship(_mentorship) {
    throw new Error('SessionStateRepository.saveMentorship() not implemented');
  }

  /**
   * @param {string} _mentorshipId
   * @returns {Promise<void>}
   */
  async deleteMentorship(_mentorshipId) {
    throw new Error('SessionStateRepository.deleteMentorship() not implemented');
  }

  /**
   * @returns {Promise<string[]>} Ids of all live mentorships.
   */
  async listMentorshipIds() {
    throw new Error('SessionStateRepository.listMentorshipIds() not implemented');
  }

  // ── Lifecycle / health ────────────────────────────────────────────────
  /**
   * @returns {Promise<boolean>} True if the backing store is reachable (readiness).
   */
  async ping() {
    return true;
  }

  /**
   * Release resources (connections). Safe to call on shutdown.
   * @returns {Promise<void>}
   */
  async close() {}
}
