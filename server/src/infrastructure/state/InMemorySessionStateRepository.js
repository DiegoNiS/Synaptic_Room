// ============================================
// Synaptic Room — In-memory state adapter
// ============================================
// A REAL adapter (not a mock) backed by two Maps. It is the correct choice for
// single-instance/dev runs, but it does NOT survive a restart and does NOT
// share state across instances — so it must not be the production default when
// durability/scale are required (the factory enforces this).
//
// Traceability: P1-R-001 · design P1-D-001.
// ============================================

import { SessionStateRepository } from '../../application/ports/SessionStateRepository.js';

export class InMemorySessionStateRepository extends SessionStateRepository {
  constructor() {
    super();
    /** @type {Map<string, import('../../domain/models/Session.js').Session>} */
    this._sessions = new Map();
    /** @type {Map<string, import('../../domain/models/Mentorship.js').Mentorship>} */
    this._mentorships = new Map();
  }

  async getSession(sessionId) {
    return this._sessions.get(sessionId) ?? null;
  }

  async saveSession(session) {
    this._sessions.set(session.sessionId, session);
  }

  async deleteSession(sessionId) {
    this._sessions.delete(sessionId);
  }

  async listSessionIds() {
    return [...this._sessions.keys()];
  }

  async getMentorship(mentorshipId) {
    return this._mentorships.get(mentorshipId) ?? null;
  }

  async saveMentorship(mentorship) {
    this._mentorships.set(mentorship.mentorshipId, mentorship);
  }

  async deleteMentorship(mentorshipId) {
    this._mentorships.delete(mentorshipId);
  }

  async listMentorshipIds() {
    return [...this._mentorships.keys()];
  }

  async ping() {
    return true;
  }
}
