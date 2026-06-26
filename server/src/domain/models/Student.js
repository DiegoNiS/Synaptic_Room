// ============================================
// Synaptic Room — Student Entity
// ============================================
// Represents the cognitive state of a student
// within a session. This is a pure domain model:
// no external dependencies, fully testable.
// ============================================

/**
 * @typedef {'flow' | 'blocked' | 'idle' | 'analyzing' | 'mentoring'} CognitiveState
 */

/**
 * Represents a student's real-time cognitive state in a session.
 * Immutable transitions via methods that return new states.
 */
export class Student {
  /**
   * @param {Object} props
   * @param {string} props.studentId - Unique student identifier
   * @param {string} props.sessionId - The session this student belongs to
   * @param {string} props.displayName - Human-readable name
   * @param {CognitiveState} [props.state='idle'] - Current cognitive state
   * @param {number} [props.confidence=0] - AI confidence (0.0 to 1.0)
   * @param {string|null} [props.blockagePoint=null] - Description of the blockage
   * @param {string|null} [props.activeMentorshipId=null] - Current mentorship if any
   * @param {number} [props.stateChangedAt=Date.now()] - When state last changed
   */
  constructor({
    studentId,
    sessionId,
    displayName,
    state = 'idle',
    confidence = 0,
    blockagePoint = null,
    activeMentorshipId = null,
    stateChangedAt = Date.now(),
  }) {
    this.studentId = studentId;
    this.sessionId = sessionId;
    this.displayName = displayName;
    this.state = state;
    this.confidence = confidence;
    this.blockagePoint = blockagePoint;
    this.activeMentorshipId = activeMentorshipId;
    this.stateChangedAt = stateChangedAt;
  }

  /**
   * Updates the cognitive state based on AI analysis results.
   * @param {Object} analysis
   * @param {CognitiveState} analysis.state
   * @param {number} analysis.confidence
   * @param {string|null} analysis.blockagePoint
   * @returns {Student} New student instance with updated state
   */
  withAnalysis({ state, confidence, blockagePoint }) {
    return new Student({
      ...this,
      state,
      confidence,
      blockagePoint,
      stateChangedAt: Date.now(),
    });
  }

  /**
   * Marks the student as participating in a mentorship.
   * @param {string} mentorshipId
   * @returns {Student}
   */
  withMentorship(mentorshipId) {
    return new Student({
      ...this,
      state: 'mentoring',
      activeMentorshipId: mentorshipId,
      stateChangedAt: Date.now(),
    });
  }

  /**
   * Clears the mentorship and reverts to idle.
   * @returns {Student}
   */
  withMentorshipCleared() {
    return new Student({
      ...this,
      state: 'idle',
      activeMentorshipId: null,
      confidence: 0,
      blockagePoint: null,
      stateChangedAt: Date.now(),
    });
  }

  /** @returns {boolean} */
  isBlocked() {
    return this.state === 'blocked' && this.confidence >= 0.6;
  }

  /** @returns {boolean} */
  isInFlow() {
    return this.state === 'flow' && this.confidence >= 0.7;
  }

  /** @returns {boolean} */
  isAvailableAsMentor() {
    return this.isInFlow() && !this.activeMentorshipId;
  }

  /** @returns {boolean} */
  needsMentor() {
    return this.isBlocked() && !this.activeMentorshipId;
  }

  /**
   * How long the student has been in the current state (ms).
   * @returns {number}
   */
  timeInCurrentState() {
    return Date.now() - this.stateChangedAt;
  }

  /**
   * Serializes for Socket.io transmission.
   * @returns {Object}
   */
  toNodeMapEntry() {
    return {
      studentId: this.studentId,
      displayName: this.displayName,
      state: this.state,
      confidence: this.confidence,
      connections: this.activeMentorshipId ? [this.activeMentorshipId] : [],
    };
  }
}
