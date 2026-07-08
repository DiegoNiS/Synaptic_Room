import { useRef, useEffect, useCallback } from 'react';
import { computeWindowMetrics } from '../lib/traceMetrics.js';

/**
 * Hook to track writing behavior across one or more text boxes on the whiteboard.
 * Aggregates keystrokes, deletions, pauses, and WPM, then calls onFlush at regular intervals.
 *
 * @param {Function} onFlush - Callback called with aggregated trace metrics
 * @param {number} [intervalMs=2000] - Frequency of trace emission
 */
export function useTracker(onFlush, intervalMs = 2000) {
  const textRef = useRef('');
  const keystrokesRef = useRef(0);
  const deletionsRef = useRef(0);
  const pasteCountRef = useRef(0);
  const maxPauseRef = useRef(0);
  const lastKeyTimeRef = useRef(Date.now());
  const intervalStartRef = useRef(Date.now());

  // Record a single keystroke event from any text box
  const recordKeystroke = useCallback((isDeletion = false) => {
    const now = Date.now();
    const pauseTime = now - lastKeyTimeRef.current;
    if (keystrokesRef.current > 0 && pauseTime > maxPauseRef.current) {
      maxPauseRef.current = pauseTime;
    }
    lastKeyTimeRef.current = now;
    keystrokesRef.current += 1;
    if (isDeletion) deletionsRef.current += 1;
  }, []);

  const recordPaste = useCallback(() => {
    pasteCountRef.current += 1;
  }, []);

  // Update the combined text snapshot from all text boxes
  const updateTextSnapshot = useCallback((text) => {
    textRef.current = text;
  }, []);

  useEffect(() => {
    lastKeyTimeRef.current = Date.now();
    intervalStartRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();

      onFlush(
        computeWindowMetrics({
          keystrokes: keystrokesRef.current,
          deletions: deletionsRef.current,
          pasteCount: pasteCountRef.current,
          maxPauseMs: maxPauseRef.current,
          idleMs: now - lastKeyTimeRef.current,
          elapsedMs: now - intervalStartRef.current,
          textSnapshot: textRef.current,
        })
      );

      keystrokesRef.current = 0;
      deletionsRef.current = 0;
      pasteCountRef.current = 0;
      maxPauseRef.current = 0;
      intervalStartRef.current = now;
    }, intervalMs);

    return () => clearInterval(timer);
  }, [onFlush, intervalMs]);

  return { recordKeystroke, recordPaste, updateTextSnapshot, textRef };
}
