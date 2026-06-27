// ============================================
// Synaptic Room — Socket Registry
// ============================================
// Maps a logical identity (sessionId:studentId) to the live
// socket id. This lets us:
//   - deliver mentorship chat/draw to the specific partner
//     instead of broadcasting to the whole room,
//   - resync a reconnecting client,
//   - detect and evict a stale duplicate (same student, two tabs).
// ============================================

export class SocketRegistry {
  constructor() {
    /** @type {Map<string, string>} key `${sessionId}:${studentId}` -> socketId */
    this._byKey = new Map();
  }

  _key(sessionId, studentId) {
    return `${sessionId}:${studentId}`;
  }

  /**
   * Registers a socket for an identity.
   * @returns {string|null} the previous socketId for this identity, if it differs
   *   (the caller should disconnect it to prevent a ghost duplicate).
   */
  register(sessionId, studentId, socketId) {
    const key = this._key(sessionId, studentId);
    const prev = this._byKey.get(key);
    this._byKey.set(key, socketId);
    return prev && prev !== socketId ? prev : null;
  }

  /** Removes the mapping only if it still points at this socket. */
  unregister(sessionId, studentId, socketId) {
    const key = this._key(sessionId, studentId);
    if (this._byKey.get(key) === socketId) {
      this._byKey.delete(key);
    }
  }

  /** @returns {string|null} */
  getSocketId(sessionId, studentId) {
    return this._byKey.get(this._key(sessionId, studentId)) || null;
  }
}
