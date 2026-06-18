/**
 * alarm-nag — the native re-fire layer that drags an escaping user back.
 *
 * The in-app sound (alarm-sound.ts) only rings while the app is in the
 * foreground with the gate up. A determined user can still try to escape the
 * challenge by BACKGROUNDING the app. This module closes that hole: while an
 * alarm is unmet AND the app is in the background, it re-fires the *native*
 * iOS AlarmKit alarm on a ~10s cycle, so the system alarm tone + Live Activity
 * keep reappearing until the challenge is completed.
 *
 * Why this works while backgrounded: the in-app alarm sound runs under the
 * "audio" UIBackgroundMode, which keeps the JS runloop alive after the app is
 * backgrounded — so the timer below keeps ticking and can keep scheduling.
 *
 * Design decisions (confirmed with the product owner):
 *   - Re-fire ONLY while the app is backgrounded. The moment the app returns to
 *     the foreground we cancel the pending native alarm, so the system
 *     full-screen alert never pops over the challenge UI and trap the user.
 *   - Use the iOS default AlarmKit tone (no custom soundName).
 *   - The Live Activity toggles on a 10s cadence: it APPEARS when we schedule a
 *     near-immediate fire, then DISAPPEARS when we cancel on the next tick, then
 *     reappears, and so on — a relentless 10s blink the user can't ignore.
 *
 * The ONLY way out is completing the challenge, which calls stopAlarmNag()
 * (via alarm-store.stopAlarm).
 *
 * A dedicated NAG_ALARM_ID keeps these transient re-fires from being mistaken
 * for a real user alarm. It is filtered out of getAllAlarms() and skipped by
 * syncWithNativeState(), and handleAlarmPayload ignores a dismiss carrying it
 * (the real alarm's pending flag already keeps the gate up).
 */

import { AppState, type AppStateStatus } from 'react-native';
import { safeAlarmKit, NAG_ALARM_ID } from '@/utils/alarm-store';

/** How often the Live Activity / native alarm toggles on/off. */
const CYCLE_MS = 10_000;
/** How far in the future each re-fire is scheduled (must be > 0). */
const FIRE_DELAY_MS = 2_000;

let cycleTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let running = false;
let nagShown = false; // is a native nag alarm currently scheduled/ringing?
let nagTitle = 'Alarm';

/** Schedule a near-immediate native alarm — the tone + Live Activity APPEAR. */
function showNag(): void {
  try {
    safeAlarmKit.scheduleAlarm({
      id: NAG_ALARM_ID,
      date: new Date(Date.now() + FIRE_DELAY_MS).toISOString(),
      title: nagTitle,
      // Bring the app forward if the user taps Dismiss — that pulls them back to
      // the challenge. The gate is re-asserted by the pending-alarm flag, not by
      // this payload (handleAlarmPayload ignores NAG_ALARM_ID).
      launchAppOnDismiss: true,
      launchAppOnSnooze: false,
      doSnoozeIntent: false,
      // No soundName → iOS default AlarmKit tone.
    });
    nagShown = true;
  } catch {}
}

/** Cancel the native alarm — the tone + Live Activity DISAPPEAR. */
function hideNag(): void {
  try {
    safeAlarmKit.cancelAlarm(NAG_ALARM_ID);
  } catch {}
  nagShown = false;
}

/** One 10s tick: blink the native alarm on/off while backgrounded. */
function tick(): void {
  // Never nag while the app is foregrounded — that would bury the challenge.
  if (AppState.currentState === 'active') {
    if (nagShown) hideNag();
    return;
  }
  if (nagShown) {
    hideNag();
  } else {
    showNag();
  }
}

function handleAppStateChange(state: AppStateStatus): void {
  if (!running) return;
  if (state === 'active') {
    // Back in the foreground: kill any pending native alarm so it can't pop the
    // system alert over the challenge. The in-app sound layer takes over.
    hideNag();
  } else {
    // Backgrounded with the gate still up: start nagging right away.
    showNag();
  }
}

/**
 * Start the native nag loop for an unmet alarm. Idempotent: a second call only
 * refreshes the title. Pair with stopAlarmNag() on challenge success.
 */
export function startAlarmNag(opts?: { title?: string }): void {
  if (opts?.title) nagTitle = opts.title;
  if (running) return;
  running = true;

  appStateSub = AppState.addEventListener('change', handleAppStateChange);
  if (!cycleTimer) {
    cycleTimer = setInterval(tick, CYCLE_MS);
  }
  // If we're already in the background when the gate goes up, nag immediately.
  if (AppState.currentState !== 'active') {
    showNag();
  }
}

/**
 * Stop the native nag loop and cancel any pending native alarm. The ONLY
 * authorised call site is the challenge-success path (alarm-store.stopAlarm).
 */
export function stopAlarmNag(): void {
  running = false;
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  hideNag();
}
