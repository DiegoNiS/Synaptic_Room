// ============================================
// Synaptic Room — Minimal In-Memory Rate Limiter
// ============================================
// Dependency-free fixed-window limiter, keyed by client IP.
// Suitable for a single-instance MVP. For multi-instance
// deployments, swap for a shared store (Redis) implementation.
// ============================================

/**
 * @param {Object} [options]
 * @param {number} [options.windowMs=60000]
 * @param {number} [options.max=30] - Max requests per window per IP
 * @returns {import('express').RequestHandler}
 */
export function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;

    // Opportunistic prune to bound memory.
    if (hits.size > 5000) {
      for (const [key, val] of hits) {
        if (now > val.resetAt) hits.delete(key);
      }
    }

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    next();
  };
}
