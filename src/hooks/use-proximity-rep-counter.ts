/**
 * useProximityRepCounter — rep counting from a 1-D proximity/size signal whose
 * absolute range isn't known up front.
 *
 * Push-ups with the phone flat on the ground produce a clean "body gets bigger
 * at the bottom, smaller at the top" signal (see `bodyScale`), but the actual
 * pixel values depend entirely on how far away the phone is. So instead of
 * fixed thresholds we auto-calibrate: track the running min (top, extended) and
 * max (bottom) with slow decay so stale extremes relax and one-off keypoint
 * spikes fade. Reps are counted on a full bottom→top swing with hysteresis and
 * a minimum interval.
 *
 * Convention: LARGER value = closer to the phone = bottom of the rep.
 */

import { useCallback, useRef } from 'react';

type Phase = 'top' | 'bottom';

export type ProximityRepConfig = {
  /** Minimum interval between counted reps (ms) — rejects flicker. */
  minIntervalMs?: number;
  /**
   * Required amplitude before any rep counts, as a fraction of the peak value.
   * Guards against counting tiny wobbles as reps. 0.15 ≈ body must grow/shrink
   * by ~15% between top and bottom.
   */
  minAmplitudeRatio?: number;
  /** Per-sample contraction of the calibrated range (fraction). */
  decayRatio?: number;
  onRep: (count: number) => void;
};

export type ProximityState = 'calibrating' | 'top' | 'bottom';

export function useProximityRepCounter({
  minIntervalMs = 500,
  minAmplitudeRatio = 0.15,
  decayRatio = 0.012,
  onRep,
}: ProximityRepConfig) {
  const min = useRef<number | null>(null);
  const max = useRef<number | null>(null);
  const phase = useRef<Phase>('top');
  const count = useRef(0);
  const lastRepAt = useRef(0);

  const push = useCallback(
    (value: number | null): ProximityState => {
      if (value == null || !Number.isFinite(value)) return phaseState(phase.current, false);

      if (min.current == null || max.current == null) {
        min.current = value;
        max.current = value;
        return 'calibrating';
      }

      // Slowly contract the observed extremes toward the live value so the
      // calibration tracks the current distance and forgets stale spikes.
      const range0 = max.current - min.current;
      const decay = range0 * decayRatio;
      min.current = Math.min(value, min.current + decay);
      max.current = Math.max(value, max.current - decay);

      const range = max.current - min.current;
      const ready = range >= minAmplitudeRatio * max.current;
      if (!ready) return 'calibrating';

      const bottomEnter = min.current + range * 0.6;
      const topEnter = min.current + range * 0.4;

      if (phase.current === 'top') {
        if (value >= bottomEnter) phase.current = 'bottom';
      } else {
        if (value <= topEnter) {
          phase.current = 'top';
          const now = Date.now();
          if (now - lastRepAt.current >= minIntervalMs) {
            lastRepAt.current = now;
            count.current += 1;
            onRep(count.current);
          }
        }
      }
      return phaseState(phase.current, true);
    },
    [decayRatio, minAmplitudeRatio, minIntervalMs, onRep],
  );

  const reset = useCallback(() => {
    min.current = null;
    max.current = null;
    phase.current = 'top';
    count.current = 0;
    lastRepAt.current = 0;
  }, []);

  return { push, reset, countRef: count };
}

function phaseState(phase: Phase, ready: boolean): ProximityState {
  if (!ready) return 'calibrating';
  return phase;
}
