// ============================================
// Synaptic Room — Mentorship Entity
// ============================================
// Represents an active micro-mentorship pair.
// Tracks the mentor, mentee, topic, and lifecycle.
// ============================================

import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {'active' | 'completed' | 'expired' | 'cancelled'} MentorshipStatus
 */

/**
 * Represents a micro-mentorship connection between two students.
 */
export class Mentorship {
  /**
   * Default mentorship duration: 5 minutes.
   * After this, the system auto-closes to prevent stale connections.
   */
  static DEFAULT_DURATION_MS = 5 * 60 * 1000;

  /**
   * @param {Object} props
   * @param {string} [props.mentorshipId] - Auto-generated UUID
   * @param {string} props.sessionId
   * @param {string} props.mentorId
   * @param {string} props.mentorName
   * @param {string} props.menteeId
   * @param {string} props.menteeName
   * @param {string} props.topic - AI-detected blockage description
   * @param {MentorshipStatus} [props.status='active']
   * @param {number} [props.createdAt=Date.now()]
   * @param {number} [props.expiresAt]
   */
  constructor({
    mentorshipId = uuidv4(),
    sessionId,
    mentorId,
    mentorName,
    menteeId,
    menteeName,
    topic,
    status = 'active',
    createdAt = Date.now(),
    expiresAt = Date.now() + Mentorship.DEFAULT_DURATION_MS,
    mentorInstructions = '',
  }) {
    this.mentorshipId = mentorshipId;
    this.sessionId = sessionId;
    this.mentorId = mentorId;
    this.mentorName = mentorName;
    this.menteeId = menteeId;
    this.menteeName = menteeName;
    this.topic = topic;
    this.status = status;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
    this.mentorInstructions = mentorInstructions;
  }

  /**
   * Creates a new Mentorship between two students.
   * Factory method for readability in use cases.
   * @param {Object} params
   * @returns {Mentorship}
   */
  static create({ sessionId, mentor, mentee, topic }) {
    return new Mentorship({
      sessionId,
      mentorId: mentor.studentId,
      mentorName: mentor.displayName,
      menteeId: mentee.studentId,
      menteeName: mentee.displayName,
      topic: topic || 'Bloqueo conceptual detectado',
    });
  }

  /** @returns {boolean} */
  isExpired() {
    return Date.now() >= this.expiresAt;
  }

  /** @returns {boolean} */
  isActive() {
    return this.status === 'active' && !this.isExpired();
  }

  /**
   * Closes the mentorship with a reason.
   * @param {'resolved' | 'timeout' | 'manual' | 'expired'} reason
   * @returns {Mentorship}
   */
  close(reason) {
    return new Mentorship({
      ...this,
      status: reason === 'resolved' ? 'completed' : reason === 'expired' ? 'expired' : 'cancelled',
      mentorInstructions: this.mentorInstructions,
    });
  }

  /**
   * Serializes for the `mentorship:start` Socket.io event.
   * @returns {Object}
   */
  toStartPayload() {
    return {
      mentorshipId: this.mentorshipId,
      mentor: {
        studentId: this.mentorId,
        displayName: this.mentorName,
      },
      mentee: {
        studentId: this.menteeId,
        displayName: this.menteeName,
      },
      topic: this.topic,
      expiresAt: this.expiresAt,
      mentorInstructions: this.mentorInstructions,
    };
  }
}
