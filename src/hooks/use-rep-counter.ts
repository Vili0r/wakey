/**
 * useRepCounter — shared rep-counting state machine.
 *
 * Feed it a joint angle each frame via push(angle). It counts one rep on every
 * full "down then up" transition, with hysteresis (separate down/up thresholds)
 * and a minimum interval to reject jitter. Squats pass the knee angle,
 * push-ups pass the elbow angle — identical counting logic for both.
 *
 * Pure JS + refs, so it's deterministic and trivial to unit-test with a
 * synthetic sequence of angles (see the test ideas at the bottom).
 */

import { useCallback, useRef } from 'react';

type Phase = 'up' | 'down';

export type RepCounterConfig = {
  /** Enter 'down' when angle drops below this (more bent). */
  downThreshold: number;
  /** Count a rep when angle rises above this from 'down' (extended). */
  upThreshold: number;
  /** Minimum ms between counted reps — rejects flicker. */
  minIntervalMs?: number;
  /** Called once per counted rep, with the new total. */
  onRep: (count: number) => void;
};

export function useRepCounter({
  downThreshold,
  upThreshold,
  minIntervalMs = 350,
  onRep,
}: RepCounterConfig) {
  const phase = useRef<Phase>('up');
  const count = useRef(0);
  const lastRepAt = useRef(0);
  // Did we actually reach a proper "down" before coming back up?
  const reachedDown = useRef(false);

  const push = useCallback(
    (angle: number | null) => {
      if (angle == null) return;

      if (phase.current === 'up') {
        if (angle < downThreshold) {
          phase.current = 'down';
          reachedDown.current = true;
        }
        return;
      }

      // phase === 'down'
      if (angle > upThreshold) {
        phase.current = 'up';
        const now = Date.now();
        if (reachedDown.current && now - lastRepAt.current >= minIntervalMs) {
          lastRepAt.current = now;
          count.current += 1;
          onRep(count.current);
        }
        reachedDown.current = false;
      }
    },
    [downThreshold, upThreshold, minIntervalMs, onRep],
  );

  const reset = useCallback(() => {
    phase.current = 'up';
    count.current = 0;
    lastRepAt.current = 0;
    reachedDown.current = false;
  }, []);

  /** Coaching hint based on where the angle sits relative to the band. */
  const hintFor = useCallback(
    (angle: number | null, downLabel: string, upLabel: string): string | null => {
      if (angle == null) return null;
      if (phase.current === 'up' && angle < downThreshold + 25) return downLabel;
      if (phase.current === 'down' && angle > upThreshold - 25) return upLabel;
      return null;
    },
    [downThreshold, upThreshold],
  );

  return { push, reset, hintFor, countRef: count, phaseRef: phase };
}

/*
 * Unit-test ideas (jest):
 *  - clean reps: [170,90,170,90,170] with down<100,up>160 => exactly 2 reps.
 *  - jitter at threshold: oscillating 95<->105 should NOT count (never crosses up).
 *  - too-fast double: two ups within minIntervalMs => second ignored.
 *  - incomplete: 170->120->170 (never reached down<100) => 0 reps.
 */
