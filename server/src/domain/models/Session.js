// ============================================
// Synaptic Room — Session Entity
// ============================================
// Represents an active classroom session.
// Manages the collection of students and
// provides queries for mentor matching.
// ============================================

import { Student } from './Student.js';

/**
 * Represents an active classroom session (one teacher, many students).
 * This is the aggregate root for all student state within a room.
 */
export class Session {
  /**
   * @param {Object} props
   * @param {string} props.sessionId - Unique session identifier
   * @param {string} [props.teacherId=null] - Teacher's socket or user ID
   * @param {Map<string, Student>} [props.students] - Map of studentId → Student
   * @param {number} [props.createdAt=Date.now()]
   */
  constructor({ sessionId, teacherId = null, students = new Map(), createdAt = Date.now() }) {
    this.sessionId = sessionId;
    this.teacherId = teacherId;
    this.students = students;
    this.createdAt = createdAt;
  }

  /**
   * Adds a student to the session.
   * @param {Student} student
   */
  addStudent(student) {
    this.students.set(student.studentId, student);
  }

  /**
   * Removes a student from the session.
   * @param {string} studentId
   * @returns {Student|undefined} The removed student
   */
  removeStudent(studentId) {
    const student = this.students.get(studentId);
    this.students.delete(studentId);
    return student;
  }

  /**
   * Gets a student by ID.
   * @param {string} studentId
   * @returns {Student|undefined}
   */
  getStudent(studentId) {
    return this.students.get(studentId);
  }

  /**
   * Updates a student's state (replaces the entry).
   * @param {Student} student - Updated student instance
   */
  updateStudent(student) {
    this.students.set(student.studentId, student);
  }

  /**
   * Finds the best available mentor for a blocked student.
   * Selection criteria (priority order):
   * 1. Must be in 'flow' state with confidence >= 0.7
   * 2. Must not be currently in a mentorship
   * 3. Highest confidence wins (they understand the topic best)
   * 
   * @param {string} excludeStudentId - The blocked student (can't mentor themselves)
   * @returns {Student|null}
   */
  findBestMentor(excludeStudentId) {
    let bestMentor = null;
    let highestConfidence = 0;

    for (const [id, student] of this.students) {
      if (id === excludeStudentId) continue;
      if (!student.isAvailableAsMentor()) continue;
      if (student.confidence > highestConfidence) {
        highestConfidence = student.confidence;
        bestMentor = student;
      }
    }

    return bestMentor;
  }

  /**
   * Returns all students who are currently blocked and need mentoring.
   * @returns {Student[]}
   */
  getBlockedStudents() {
    return Array.from(this.students.values()).filter((s) => s.needsMentor());
  }

  /**
   * Generates the full node map for the teacher's dashboard.
   * @returns {Object}
   */
  toNodeMap() {
    return {
      sessionId: this.sessionId,
      nodes: Array.from(this.students.values()).map((s) => s.toNodeMapEntry()),
      updatedAt: Date.now(),
    };
  }

  /** @returns {number} */
  get studentCount() {
    return this.students.size;
  }
}
