// ============================================
// Synaptic Room — Durable, Map-compatible entity store
// ============================================
// A write-through cache that preserves the SYNCHRONOUS Map interface the socket
// handlers and use cases already use (`get/set/delete/has/size/values`), while
// giving us durability + horizontal scale behind the scenes:
//
//   • reads  → served from an in-process cache (no added latency; P1-AC-006)
//   • writes → written through to the SessionStateRepository (Redis) AND
//              published on a pub/sub channel so OTHER instances refresh their
//              cache (cross-instance consistency; P1-AC-003)
//   • boot   → rehydrated from the repository so a restart does NOT lose the
//              live classroom (P1-AC-001)
//
// It works with or without Redis: when no pub/sub clients are supplied it is a
// single-instance durable cache over the (in-memory) repository. The domain and
// application layers never see Redis — only this Map-like facade (P1-AC-002).
//
// Traceability: P1-R-001/002/003 · design P1-D-001.
// ============================================

import { createComponentLogger } from '../../utils/logger.js';

const log = createComponentLogger('durable-store');

export class DurableEntityStore {
  /**
   * @param {Object} cfg
   * @param {string} cfg.name                         Logical name (for logs/channel).
   * @param {(id:string)=>Promise<any|null>} cfg.load Repository read.
   * @param {(entity:any)=>Promise<void>} cfg.save    Repository write.
   * @param {(id:string)=>Promise<void>} cfg.remove   Repository delete.
   * @param {()=>Promise<string[]>} cfg.listIds       Repository id listing.
   * @param {(entity:any)=>string} cfg.idOf           Extracts the id from an entity.
   * @param {string} cfg.instanceId                   Unique id of this server instance.
   * @param {import('ioredis').Redis|null} [cfg.pubClient] Pub/sub publisher (optional).
   * @param {import('ioredis').Redis|null} [cfg.subClient] Pub/sub subscriber (optional).
   */
  constructor({
    name,
    load,
    save,
    remove,
    listIds,
    idOf,
    instanceId,
    pubClient = null,
    subClient = null,
  }) {
    this._name = name;
    this._load = load;
    this._save = save;
    this._remove = remove;
    this._listIds = listIds;
    this._idOf = idOf;
    this._instanceId = instanceId;
    this._pub = pubClient;
    this._sub = subClient;
    this._channel = `sync:${name}`;
    /** @type {Map<string, any>} in-process projection */
    this._cache = new Map();
  }

  // ── Boot: rehydrate + subscribe ─────────────────────────────────────────
  async init() {
    const ids = await this._listIds();
    for (const id of ids) {
      const entity = await this._load(id);
      if (entity) this._cache.set(id, entity);
    }
    log.info({ store: this._name, restored: this._cache.size }, 'State rehydrated from repository');

    if (this._sub) {
      await this._sub.subscribe(this._channel);
      this._sub.on('message', (channel, message) => {
        if (channel === this._channel) this._onSyncMessage(message);
      });
      log.info({ store: this._name, channel: this._channel }, 'Cross-instance sync subscribed');
    }
  }

  /** Reacts to another instance's write so this cache stays consistent. */
  async _onSyncMessage(message) {
    let payload;
    try {
      payload = JSON.parse(message);
    } catch {
      return;
    }
    if (!payload || payload.from === this._instanceId) return; // ignore our own echo

    try {
      if (payload.op === 'del') {
        this._cache.delete(payload.id);
      } else if (payload.op === 'set') {
        const entity = await this._load(payload.id);
        if (entity) this._cache.set(payload.id, entity);
        else this._cache.delete(payload.id);
      }
    } catch (err) {
      log.warn({ store: this._name, err }, 'Failed to apply cross-instance sync');
    }
  }

  _publish(op, id) {
    if (!this._pub) return;
    this._pub
      .publish(this._channel, JSON.stringify({ op, id, from: this._instanceId }))
      .catch((err) => log.warn({ store: this._name, err }, 'sync publish failed'));
  }

  // ── Write-through (fire-and-forget persistence; write-behind cache) ─────
  _persistEntity(entity) {
    const id = this._idOf(entity);
    this._save(entity).catch((err) =>
      log.error({ store: this._name, id, err }, 'write-through persist failed')
    );
    this._publish('set', id);
  }

  // ── Map-compatible API (synchronous reads/writes) ───────────────────────
  get(id) {
    return this._cache.get(id);
  }

  has(id) {
    return this._cache.has(id);
  }

  set(id, entity) {
    this._cache.set(id, entity);
    this._persistEntity(entity);
    return this;
  }

  delete(id) {
    const existed = this._cache.delete(id);
    this._remove(id).catch((err) =>
      log.error({ store: this._name, id, err }, 'write-through delete failed')
    );
    this._publish('del', id);
    return existed;
  }

  /**
   * Persists an entity that was mutated in place (e.g. session.addStudent).
   * No-op-safe to call liberally after any mutation. Distinct from set() only
   * in intent; both write through.
   * @param {any} entity
   */
  persist(entity) {
    const id = this._idOf(entity);
    this._cache.set(id, entity);
    this._persistEntity(entity);
  }

  get size() {
    return this._cache.size;
  }

  keys() {
    return this._cache.keys();
  }

  values() {
    return this._cache.values();
  }

  entries() {
    return this._cache.entries();
  }

  forEach(cb, thisArg) {
    this._cache.forEach(cb, thisArg);
  }

  [Symbol.iterator]() {
    return this._cache[Symbol.iterator]();
  }

  async close() {
    try {
      if (this._sub) await this._sub.unsubscribe(this._channel).catch(() => {});
    } catch {
      // best effort
    }
  }
}
