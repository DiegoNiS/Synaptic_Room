// ============================================
// Synaptic Room — Domain Events
// ============================================
// Central registry of all event names used across
// the system. This is the single source of truth
// for both Socket.io events and internal bus events.
// ============================================

/**
 * Socket.io events received FROM the Frontend (Maxs).
 * These are the events the server LISTENS for.
 */
export const SOCKET_INCOMING = Object.freeze({
  // Keystroke trace stream (join is implicit on connect; leave is 'disconnect')
  STUDENT_TRACE: 'student:trace',

  // Mentorship actions
  MENTORSHIP_CLOSE: 'mentorship:close',
  MENTORSHIP_MESSAGE: 'mentorship:message',
  MENTORSHIP_DRAW: 'mentorship:draw',
});

/**
 * Socket.io events emitted TO the Frontend (Maxs).
 * These are the events the server SENDS.
 */
export const SOCKET_OUTGOING = Object.freeze({
  // Cognitive state updates (per student)
  COGNITIVE_STATE: 'cognitive:state',

  // Mentorship lifecycle
  MENTORSHIP_START: 'mentorship:start',
  MENTORSHIP_ENDED: 'mentorship:ended',

  // Session-wide updates (for teacher dashboard)
  SESSION_NODE_MAP: 'session:nodeMap',

  // System notifications
  SESSION_ERROR: 'session:error',
});

/**
 * Internal application events (for decoupling use cases).
 * Not sent over the network — used between services.
 */
export const INTERNAL_EVENTS = Object.freeze({
  TRACE_BUFFER_FLUSH: 'internal:trace:flush',
  STUDENT_STATE_CHANGED: 'internal:student:stateChanged',
  MENTORSHIP_CREATED: 'internal:mentorship:created',
});
