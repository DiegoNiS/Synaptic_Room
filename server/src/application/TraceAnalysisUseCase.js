// ============================================
// Synaptic Room — Trace Analysis Use Case
// ============================================
// Orchestrates the full flow:
//   1. Receive aggregated trace data from the buffer
//   2. Classify state locally with a heuristic rule engine
//   3. ONLY call AI Agent when student is blocked (deep semantic analysis)
//   4. Update the student's domain model
//   5. Emit state change to the frontend
//   6. Trigger mentorship if student is blocked
//
// OPTIMIZATION: The local rule engine handles ~95% of
// classifications instantly (flow/idle) without any
// HTTP call. The AI is reserved exclusively for
// blocked students to determine the exact blockagePoint
// via semantic analysis of their textSnapshot.
//
// SOLID: Single responsibility — this use case
// only handles trace → analysis → state update.
// Mentorship creation is delegated to MentorshipUseCase.
// ============================================

import { createComponentLogger } from '../utils/logger.js';

const log = createComponentLogger('trace-analysis');

// ── Heuristic thresholds (tunable) ──────────────────────────────────
const THRESHOLDS = {
  FLOW_WPM_MIN: 10,           // WPM above this → likely in flow
  FLOW_BACKSPACE_MAX: 0.15,   // Low deletion ratio → not struggling
  BLOCKED_WPM_MAX: 5,         // WPM below this → likely blocked
  BLOCKED_PAUSE_MS: 8000,     // Pause longer than 8s → likely blocked
  BLOCKED_BACKSPACE_MIN: 0.30, // High deletion → struggling
  IDLE_PAUSE_MS: 3000,        // Pause between 3-8s → processing/idle
  FRAUD_PASTE_MAX: 1,         // Pasting code is heavily penalized
};

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

  // ──────────────────────────────────────────────────────────────────
  // LOCAL RULE ENGINE — Heuristic classification (zero-cost, instant)
  // ──────────────────────────────────────────────────────────────────
  /**
   * Classifies the student's cognitive state using simple heuristic
   * rules. This eliminates ~95% of unnecessary AI API calls.
   *
   * @param {Object} metrics - Aggregated trace metrics
   * @param {number} metrics.wpm
   * @param {number} metrics.pauseDurationMs
   * @param {number} metrics.pasteCount
   * @param {number} backspaceRatio - Pre-calculated deletion ratio
   * @returns {{ state: string, confidence: number }}
   */
  /**
   * Bounds and flattens an AI-produced blockage description before it is
   * stored/broadcast. Defends against prompt-injected, oversized, or
   * multi-line output reaching the dashboard.
   * @param {string|null} raw
   * @returns {string|null}
   */
  _sanitizeBlockagePoint(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const flat = raw.replace(/\s+/g, ' ').trim();
    if (!flat) return null;
    return flat.slice(0, 160);
  }

  _classifyLocally(metrics, backspaceRatio) {
    const { wpm, pauseDurationMs, pasteCount } = metrics;

    // ── PLAGIARISM: Immediate flag if code was pasted ──
    if (pasteCount >= THRESHOLDS.FRAUD_PASTE_MAX) {
      return { state: 'fraude', confidence: 0.99 };
    }

    // ── FLOW: Typing steadily with low friction ──
    if (wpm >= THRESHOLDS.FLOW_WPM_MIN && backspaceRatio < THRESHOLDS.FLOW_BACKSPACE_MAX) {
      return { state: 'flow', confidence: 0.85 };
    }

    // ── BLOCKED: Multiple strong signals of struggle ──
    // Condition 1: Very low WPM + high deletion ratio
    if (wpm < THRESHOLDS.BLOCKED_WPM_MAX && backspaceRatio >= THRESHOLDS.BLOCKED_BACKSPACE_MIN) {
      return { state: 'blocked', confidence: 0.80 };
    }
    // Condition 2: Long pause (student completely stopped)
    if (pauseDurationMs >= THRESHOLDS.BLOCKED_PAUSE_MS) {
      return { state: 'blocked', confidence: 0.75 };
    }
    // Condition 3: Extremely low WPM (almost no output)
    if (wpm < THRESHOLDS.BLOCKED_WPM_MAX && pauseDurationMs >= THRESHOLDS.IDLE_PAUSE_MS) {
      return { state: 'blocked', confidence: 0.70 };
    }

    // ── IDLE: In between — could be thinking, reading, etc. ──
    return { state: 'idle', confidence: 0.65 };
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

    // Mentorship state is sticky: a mentor/mentee who keeps typing must not be
    // reclassified out of 'mentoring' while the session is live.
    if (student.activeMentorshipId) {
      log.debug({ studentId }, 'Skipping analysis — student is in an active mentorship');
      return;
    }

    // Calculate backspace ratio safely
    const keystrokes = aggregatedMetrics.keystrokeCount || 1;
    const backspaceRatio = aggregatedMetrics.deletionCount / keystrokes;

    // ──────────────────────────────────────────────────────────────
    // STEP 1: Local heuristic classification (instant, zero-cost)
    // ──────────────────────────────────────────────────────────────
    const heuristic = this._classifyLocally(aggregatedMetrics, backspaceRatio);

    log.debug(
      { studentId, heuristicState: heuristic.state, wpm: aggregatedMetrics.wpm, backspaceRatio },
      'Local rule engine classification'
    );

    let finalState = heuristic.state;
    let finalConfidence = heuristic.confidence;
    let finalBlockagePoint = null;
    let isDegraded = false;

    // ──────────────────────────────────────────────────────────────
    // STEP 2: Deep AI analysis — ONLY when heuristic says "blocked"
    // ──────────────────────────────────────────────────────────────
    if (heuristic.state === 'blocked') {
      log.info(
        { studentId, wpm: aggregatedMetrics.wpm, pause: aggregatedMetrics.pauseDurationMs },
        'Heuristic detected BLOCKED — invoking AI for deep semantic analysis'
      );

      // Build the payload for the AI Agent
      const tracePayload = {
        studentId,
        sessionId,
        windowMetrics: {
          wpm: aggregatedMetrics.wpm,
          pauseDurationMs: aggregatedMetrics.pauseDurationMs,
          deletionCount: aggregatedMetrics.deletionCount,
          keystrokeCount: aggregatedMetrics.keystrokeCount,
          textSnapshot: aggregatedMetrics.textSnapshot || '',
          windowSizeMs: aggregatedMetrics.windowSizeMs || 0,
          eventCount: aggregatedMetrics.eventCount || 1,
        },
        historicalContext: {
          lastState: student.state || 'idle',
          blockedForMs: student.state === 'blocked' ? student.timeInCurrentState() : 0,
        },
      };

      // Call the AI Agent (protected by circuit breaker + retry)
      const response = await this.agentClient.analyzeTrace(tracePayload);

      if (response.degraded) {
        // AI unavailable — use the heuristic result
        isDegraded = true;
        log.warn({ studentId }, 'AI degraded — using heuristic classification only');
      } else {
        // AI succeeded — use its refined classification
        finalState = response.analysis.state;
        finalConfidence = response.analysis.confidence;
        // Sanitize: blockagePoint is model output derived from untrusted
        // student text and is shown to teachers/peers. Bound and flatten it.
        finalBlockagePoint = this._sanitizeBlockagePoint(response.analysis.blockagePoint);

        log.info(
          { studentId, aiState: finalState, aiConfidence: finalConfidence, blockagePoint: finalBlockagePoint },
          'AI deep analysis completed'
        );
      }
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 3: Update the domain model
    // ──────────────────────────────────────────────────────────────
    const updatedStudent = student.withAnalysis({
      state: finalState,
      confidence: finalConfidence,
      blockagePoint: finalBlockagePoint,
    });

    session.updateStudent(updatedStudent);

    // ──────────────────────────────────────────────────────────────
    // STEP 4: Emit state change to the session room
    // ──────────────────────────────────────────────────────────────
    this.io.to(sessionId).emit('cognitive:state', {
      studentId: updatedStudent.studentId,
      state: updatedStudent.state,
      confidence: updatedStudent.confidence,
      blockagePoint: updatedStudent.blockagePoint,
    });

    // STEP 5: Emit updated node map for the teacher dashboard
    this.io.to(`teacher:${sessionId}`).emit('session:nodeMap', session.toNodeMap());

    // Emit AI error details if degraded, otherwise clear it
    if (isDegraded) {
      this.io.to(sessionId).emit('ai:error', {
        studentId,
        message: 'Análisis de IA temporalmente no disponible — usando clasificación heurística',
      });
    } else {
      this.io.to(sessionId).emit('ai:clear-error', { studentId });
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 6: Log significant state changes to Supabase (fire-and-forget)
    // ──────────────────────────────────────────────────────────────
    if (updatedStudent.state === 'blocked') {
      this.sessionRepository.logEvent({
        sessionId,
        studentId,
        eventType: 'blocked',
        metadata: {
          confidence: updatedStudent.confidence,
          blockagePoint: updatedStudent.blockagePoint,
          classifiedBy: isDegraded ? 'heuristic' : 'ai',
        },
      });
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 7: Check if this student needs a mentor
    // ──────────────────────────────────────────────────────────────
    if (updatedStudent.needsMentor()) {
      log.info(
        { studentId, confidence: updatedStudent.confidence },
        'Student blocked — attempting mentor match'
      );
      await this.mentorshipUseCase.attemptMatch(sessionId, studentId);
    }
  }
}
