// ============================================
// Synaptic Room — Trace Analysis Use Case
// ============================================
// Orchestrates the full flow:
//   1. Receive aggregated trace data from the buffer
//   2. Send to AI Agent for cognitive analysis
//   3. Update the student's domain model
//   4. Emit state change to the frontend
//   5. Trigger mentorship if student is blocked
//
// SOLID: Single responsibility — this use case
// only handles trace → analysis → state update.
// Mentorship creation is delegated to MentorshipUseCase.
// ============================================

import { createComponentLogger } from '../utils/logger.js';

const log = createComponentLogger('trace-analysis');

export class TraceAnalysisUseCase {
  /**
   * @param {Object} deps - Injected dependencies
   * @param {import('../infrastructure/ai/AgentClient.js').AgentClient} deps.agentClient
   * @param {import('../infrastructure/db/SessionRepository.js').SessionRepository} deps.sessionRepository
   * @param {Map<string, import('../domain/models/Session.js').Session>} deps.activeSessions
   * @param {import('./MentorshipUseCase.js').MentorshipUseCase} deps.mentorshipUseCase
   * @param {import('socket.io').Server} deps.io - Socket.io server instance
   */
  constructor({ agentClient, sessionRepository, activeSessions, mentorshipUseCase, io }) {
    this.agentClient = agentClient;
    this.sessionRepository = sessionRepository;
    this.activeSessions = activeSessions;
    this.mentorshipUseCase = mentorshipUseCase;
    this.io = io;
  }

  /**
   * Processes an aggregated trace window for a student.
   * This is the main callback wired to TraceBuffer.onFlush.
   *
   * @param {string} studentId
   * @param {string} sessionId
   * @param {Object} aggregatedMetrics - From TraceBuffer._aggregate()
   */
  async execute(studentId, sessionId, aggregatedMetrics) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      log.warn({ sessionId, studentId }, 'Session not found — trace discarded');
      return;
    }

    const student = session.getStudent(studentId);
    if (!student) {
      log.warn({ sessionId, studentId }, 'Student not in session — trace discarded');
      return;
    }

    // 1. Build the payload for the AI Agent
    const tracePayload = {
      sessionId,
      studentId,
      windowMetrics: aggregatedMetrics,
      historicalContext: {
        lastState: student.state,
        blockedForMs: student.state === 'blocked' ? student.timeInCurrentState() : 0,
      },
    };

    // 2. Call the AI Agent (protected by circuit breaker + retry)
    const response = await this.agentClient.analyzeTrace(tracePayload);

    // 3. Update the domain model
    const updatedStudent = student.withAnalysis({
      state: response.analysis.state,
      confidence: response.analysis.confidence,
      blockagePoint: response.analysis.blockagePoint,
    });

    session.updateStudent(updatedStudent);

    // 4. Emit state change to the session room
    this.io.to(sessionId).emit('cognitive:state', {
      studentId: updatedStudent.studentId,
      state: updatedStudent.state,
      confidence: updatedStudent.confidence,
      blockagePoint: updatedStudent.blockagePoint,
    });

    // 5. Emit updated node map for the teacher dashboard
    this.io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());

    // Emit AI error details if degraded, otherwise clear it
    if (response.degraded) {
      this.io.to(sessionId).emit('ai:error', {
        studentId,
        message: `Error en análisis de IA: ${response.error || 'Servicio no disponible'}`
      });
    } else {
      this.io.to(sessionId).emit('ai:clear-error', { studentId });
    }

    // 6. Log significant state changes to Supabase (fire-and-forget)
    if (updatedStudent.state === 'blocked') {
      this.sessionRepository.logEvent({
        sessionId,
        studentId,
        eventType: 'blocked',
        metadata: {
          confidence: updatedStudent.confidence,
          blockagePoint: updatedStudent.blockagePoint,
        },
      });
    }

    // 7. Check if this student needs a mentor
    if (updatedStudent.needsMentor()) {
      log.info(
        { studentId, confidence: updatedStudent.confidence },
        'Student blocked — attempting mentor match'
      );
      await this.mentorshipUseCase.attemptMatch(sessionId, studentId);
    }
  }
}
