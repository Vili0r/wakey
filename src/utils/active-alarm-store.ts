/**
 * active-alarm-store — the single source of truth for "is an alarm gate active".
 *
 * The dismiss payload can be delivered in any render pass or app-state path, so
 * the truth lives in a module-level value and is mirrored into React via
 * useSyncExternalStore. Components that need it subscribe directly with
 * `useActiveAlarm()` instead of receiving it through props — this avoids any
 * reconciliation path where a deeply-nested sibling stops re-rendering and the
 * gate silently never shows.
 */

import { useSyncExternalStore } from 'react';

export type ActiveAlarm = {
  alarmId: string;
  challenge: string; // 'squats' | 'pushups' | 'scan' | 'math' | ...
  difficulty: 'gentle' | 'standard' | 'brutal';
  soundId?: string | null; // which tone to ring; null → default tone
};

let activeAlarm: ActiveAlarm | null = null;
const subscribers = new Set<() => void>();

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot() {
  return activeAlarm;
}

/** Set (or clear) the active alarm. Notifies every subscribed component. */
export function setActiveAlarm(val: ActiveAlarm | null) {
  if (val === activeAlarm) return;
  activeAlarm = val;
  subscribers.forEach((cb) => cb());
}

/** Non-reactive read, for code outside React (effects, callbacks). */
export function getActiveAlarm() {
  return activeAlarm;
}

/** Reactive read. Re-renders the caller whenever the active alarm changes. */
export function useActiveAlarm(): ActiveAlarm | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}
