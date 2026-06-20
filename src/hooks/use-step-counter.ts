/**
 * useStepCounter — counts real walking steps for the Steps challenge.
 *
 * Uses accelerometer peak detection: each stride produces a clear up-down
 * bounce in the acceleration magnitude, which we count one step per
 * peak→trough crossing (debounced). This fires once per step directly in JS,
 * so the on-screen counter updates the instant a step is taken.
 *
 * We deliberately avoid the CoreMotion pedometer (`Pedometer.watchStepCount`)
 * here: although it's more accurate, iOS delivers its updates in delayed
 * batches, which made the counter appear frozen at 0 and then "jump" to
 * complete. For a short "walk N steps" alarm challenge, instant per-step
 * feedback matters more than hardware-grade accuracy.
 */

import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

export type StepSource = 'pending' | 'accelerometer';

export function useStepCounter(active: boolean) {
  const [steps, setSteps] = useState(0);
  const [source, setSource] = useState<StepSource>('pending');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    try {
      Accelerometer.setUpdateInterval(80); // ~12.5 Hz
      // Acceleration magnitude (in g). ~1 at rest; a stride produces a clear
      // peak then trough. Count one step per peak→trough crossing, debounced.
      const PEAK = 1.08;
      const TROUGH = 1.0;
      const MIN_STEP_GAP_MS = 250;
      let armed = false;
      let lastStepAt = 0;
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (mag > PEAK) armed = true;
        if (armed && mag < TROUGH) {
          armed = false;
          if (now - lastStepAt > MIN_STEP_GAP_MS) {
            lastStepAt = now;
            setSteps((s) => s + 1);
          }
        }
      });
    } catch {
      // No motion sensors available (e.g. simulator) — counter stays at 0.
    }
    if (!cancelled) setSource('accelerometer');

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, [active]);

  return { steps, source };
}
