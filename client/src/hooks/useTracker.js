import { useRef, useEffect } from 'react';

/**
 * Hook to track typing behavior on a textarea element.
 * Aggregates keystrokes, deletions, pauses, and WPM, then calls onFlush at regular intervals.
 * 
 * @param {Function} onFlush - Callback called with aggregated trace metrics
 * @param {number} [intervalMs=1500] - Frequency of trace emission
 */
export function useTracker(onFlush, intervalMs = 1500) {
  const textRef = useRef('');
  
  // Accumulated metrics for the current window
  const keystrokesRef = useRef(0);
  const deletionsRef = useRef(0);
  const maxPauseRef = useRef(0);
  const lastKeyTimeRef = useRef(Date.now());
  const intervalStartRef = useRef(Date.now());

  // Handle typing key downs
  const handleKeyDown = (e) => {
    const now = Date.now();
    const pauseTime = now - lastKeyTimeRef.current;
    
    // Track maximum pause duration between keystrokes in this window
    if (keystrokesRef.current > 0 && pauseTime > maxPauseRef.current) {
      maxPauseRef.current = pauseTime;
    }
    
    lastKeyTimeRef.current = now;
    keystrokesRef.current += 1;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      deletionsRef.current += 1;
    }
  };

  // Handle text changes to capture snapshots
  const handleChange = (e) => {
    textRef.current = e.target.value;
  };

  useEffect(() => {
    lastKeyTimeRef.current = Date.now();
    intervalStartRef.current = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const text = textRef.current;

      // Calculate WPM: (characters / 5) / (elapsed minutes)
      // For instantaneous WPM, we can look at characters added in the current interval, 
      // or evaluate the overall text length relative to session start. Let's do a moving estimate.
      const elapsedMinutes = (now - intervalStartRef.current) / 60000;
      
      // Calculate WPM based on keystrokes in this interval
      // WPM = (keystrokes / 5) / elapsedMinutes
      let wpm = 0;
      if (elapsedMinutes > 0) {
        wpm = Math.round((keystrokesRef.current / 5) / elapsedMinutes);
      }

      // If no typing occurred, calculate the idle pause time since the last key
      let pauseDurationMs = maxPauseRef.current;
      const idleTime = now - lastKeyTimeRef.current;
      if (idleTime > pauseDurationMs) {
        pauseDurationMs = idleTime;
      }

      // Flush metrics to parent callback
      onFlush({
        wpm: wpm || 0,
        pauseDurationMs: Math.round(pauseDurationMs),
        deletionCount: deletionsRef.current,
        keystrokeCount: keystrokesRef.current,
        textSnapshot: text || '',
      });

      // Reset accumulators for next interval
      keystrokesRef.current = 0;
      deletionsRef.current = 0;
      maxPauseRef.current = 0;
      intervalStartRef.current = now;
    }, intervalMs);

    return () => clearInterval(timer);
  }, [onFlush, intervalMs]);

  return {
    handleKeyDown,
    handleChange,
    textRef,
  };
}
