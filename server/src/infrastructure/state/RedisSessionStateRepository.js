// ============================================
// Synaptic Room — Redis state adapter (hot state)
// ============================================
// Externalizes session + mentorship state to Redis so a server restart does NOT
// lose the live classroom and multiple instances share one source of truth
// (P1-R-001/002). Entities are stored as JSON with a TTL; an index SET tracks
// live ids and is self-healing against TTL expiry.
//
// The ioredis client is INJECTED (constructor) so the same code runs against a
// real Redis in production and an in-memory Redis-compatible server in tests —
// no branching, no mocks of our own logic.
//
// Traceability: P1-R-001/002 · design P1-D-001 · ADR-003.
// ============================================

import { SessionStateRepository } from '../../application/ports/SessionStateRepository.js';
import { Session } from '../../domain/models/Session.js';
import { Mentorship } from '../../domain/models/Mentorship.js';
import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('redis-state');

const SESSION_KEY = (id) => `sess:${id}`;
const MENTORSHIP_KEY = (id) => `ment:${id}`;
const SESSION_INDEX = 'idx:sessions';
const MENTORSHIP_INDEX = 'idx:mentorships';

export class RedisSessionStateRepository extends SessionStateRepository {
  /**
   * @param {import('ioredis').Redis} client - Connected ioredis client.
   * @param {Object} [opts]
   * @param {number} [opts.hotTtlSeconds=7200] - TTL applied to each entity (refreshed on save).
   */
  constructor(client, { hotTtlSeconds = 7200 } = {}) {
    super();
    if (!client) throw new Error('RedisSessionStateRepository requires an ioredis client');
    this._redis = client;
    this._ttl = hotTtlSeconds;
  }

  // ── internal helpers ──────────────────────────────────────────────────
  async _saveEntity(indexKey, key, id, json) {
    await this._redis.multi().sadd(indexKey, id).set(key, json, 'EX', this._ttl).exec();
  }

  async _deleteEntity(indexKey, key, id) {
    await this._redis.multi().srem(indexKey, id).del(key).exec();
  }

  /** Returns live ids, pruning any that expired out from under the index. */
  async _listLiveIds(indexKey, keyFn) {
    const ids = await this._redis.smembers(indexKey);
    if (ids.length === 0) return [];

    const pipeline = this._redis.pipeline();
    for (const id of ids) pipeline.exists(keyFn(id));
    const results = await pipeline.exec();

    const live = [];
    const stale = [];
    ids.forEach((id, i) => {
      const exists = results[i] && results[i][1];
      if (exists) live.push(id);
      else stale.push(id);
    });

    if (stale.length > 0) {
      await this._redis.srem(indexKey, ...stale);
    }
    return live;
  }

  // ── Sessions ──────────────────────────────────────────────────────────
  async getSession(sessionId) {
    const raw = await this._redis.get(SESSION_KEY(sessionId));
    if (!raw) return null;
    try {
      return Session.fromJSON(JSON.parse(raw));
    } catch (err) {
      log.error({ sessionId, err }, 'Corrupt session payload — treating as missing');
      return null;
    }
  }

  async saveSession(session) {
    await this._saveEntity(
      SESSION_INDEX,
      SESSION_KEY(session.sessionId),
      session.sessionId,
      JSON.stringify(session.toJSON())
    );
  }

  async deleteSession(sessionId) {
    await this._deleteEntity(SESSION_INDEX, SESSION_KEY(sessionId), sessionId);
  }

  async listSessionIds() {
    return this._listLiveIds(SESSION_INDEX, SESSION_KEY);
  }

  // ── Mentorships ───────────────────────────────────────────────────────
  async getMentorship(mentorshipId) {
    const raw = await this._redis.get(MENTORSHIP_KEY(mentorshipId));
    if (!raw) return null;
    try {
      return Mentorship.fromJSON(JSON.parse(raw));
    } catch (err) {
      log.error({ mentorshipId, err }, 'Corrupt mentorship payload — treating as missing');
      return null;
    }
  }

  async saveMentorship(mentorship) {
    await this._saveEntity(
      MENTORSHIP_INDEX,
      MENTORSHIP_KEY(mentorship.mentorshipId),
      mentorship.mentorshipId,
      JSON.stringify(mentorship.toJSON())
    );
  }

  async deleteMentorship(mentorshipId) {
    await this._deleteEntity(MENTORSHIP_INDEX, MENTORSHIP_KEY(mentorshipId), mentorshipId);
  }

  async listMentorshipIds() {
    return this._listLiveIds(MENTORSHIP_INDEX, MENTORSHIP_KEY);
  }

  // ── Lifecycle / health ────────────────────────────────────────────────
  async ping() {
    try {
      return (await this._redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close() {
    try {
      await this._redis.quit();
    } catch {
      // ignore — best effort on shutdown
    }
  }
}
