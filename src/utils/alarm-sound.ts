/**
 * alarm-sound — the in-app noise layer that makes the gate real.
 *
 * The iOS AlarmKit system alarm has a mandatory "Dismiss" button we cannot
 * remove; tapping it silences the *system* alarm and launches the app. That
 * means the system alarm can only be treated as a WAKE. The actual,
 * un-silenceable alarm experience lives HERE, inside the app, behind the
 * challenge gate:
 *
 *   - startAlarmSound() rings in intermittent BURSTS (BURST_MS on, GAP_MS off)
 *     rather than a constant loop — present and nagging, but not continuously
 *     distracting — alongside repeating haptics.
 *   - The ONLY authorised call site for stopAlarmSound() is the challenge
 *     success path (alarm-store.stopAlarm → ActiveAlarmOverlay.handleComplete).
 *   - Configured to play through the silent switch and keep going in the
 *     background (UIBackgroundModes: ["audio"]) so the user can't escape by
 *     flipping mute or backgrounding the app.
 *
 * The tone is chosen per-alarm: startAlarmSound(soundId) resolves the bundled
 * asset from the alarm-sounds registry. Add new tones in src/utils/alarm-sounds.ts
 * (drop a file in assets/sounds and append an entry) — nothing here changes.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as ExpoHaptics from 'expo-haptics';
import { getAlarmSound, getSoundSource } from '@/utils/alarm-sounds';

// Burst cadence: ring for BURST_MS, then stay silent for GAP_MS, repeat.
const BURST_MS = 3000;
const GAP_MS = 4000;

let player: AudioPlayer | null = null;
let hapticTimer: ReturnType<typeof setInterval> | null = null;
let cycleTimer: ReturnType<typeof setInterval> | null = null;
let burstTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Play one burst: restart from the top, ring, then pause after BURST_MS. The
 * player loops internally so the burst is a consistent BURST_MS regardless of
 * how long the source clip is.
 */
function playBurst(): void {
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {}
  if (burstTimer) clearTimeout(burstTimer);
  burstTimer = setTimeout(() => {
    try {
      player?.pause();
    } catch {}
  }, BURST_MS);
}

/**
 * Start the in-app alarm sound + haptics. Idempotent: calling it while already
 * playing is a no-op, so foreground re-assertions are safe.
 */
export async function startAlarmSound(soundId?: string | null): Promise<void> {
  if (player) return; // already ringing

  if (__DEV__) {
    console.log('[alarm-sound] ringing tone:', getAlarmSound(soundId).name, `(id=${soundId ?? 'null→default'})`);
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch {
    // Audio session config best-effort; still try to play.
  }

  try {
    player = createAudioPlayer(getSoundSource(soundId));
    player.loop = true; // loops WITHIN a burst; bursts are gated by the timers
    player.volume = 1.0;
  } catch {
    player = null;
  }

  // Ring the first burst immediately, then repeat on the burst+gap cadence.
  if (player && !cycleTimer) {
    playBurst();
    cycleTimer = setInterval(playBurst, BURST_MS + GAP_MS);
  }

  // Relentless haptics alongside the sound.
  if (!hapticTimer) {
    hapticTimer = setInterval(() => {
      ExpoHaptics.notificationAsync(
        ExpoHaptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    }, 1500);
  }
}

/**
 * Stop the in-app alarm sound + haptics and release resources.
 * Only call this on challenge success (via alarm-store.stopAlarm).
 */
export function stopAlarmSound(): void {
  if (cycleTimer) {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }
  if (burstTimer) {
    clearTimeout(burstTimer);
    burstTimer = null;
  }
  if (hapticTimer) {
    clearInterval(hapticTimer);
    hapticTimer = null;
  }
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {}
    player = null;
  }
}
