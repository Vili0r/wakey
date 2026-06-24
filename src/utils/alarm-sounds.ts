/**
 * alarm-sounds — the catalogue of selectable alarm tones.
 *
 * One place that maps a stable string `id` (persisted on the alarm row as
 * `sound_id`, and on settings as `default_sound_id`) to the bundled audio asset
 * and its display name. Add a new tone by dropping a file in assets/sounds and
 * appending an entry here — everything else (the pickers, playback, previews)
 * reads from this list.
 *
 * The synthesized tones (classic_beep … digital_pulse) are produced by
 * scripts/generate-sounds.js. `sunrise` is the original bundled alarm.wav and
 * doubles as the default so it always lines up with the DB defaults.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type AlarmSound = {
  id: string;
  name: string;
  description: string;
  source: number; // require() asset module id
};

export const ALARM_SOUNDS: AlarmSound[] = [
  {
    id: 'sunrise',
    name: 'Sunrise',
    description: 'The original warm wake-up tone',
    source: require('../../assets/sounds/alarm.wav'),
  },
  {
    id: 'classic_beep',
    name: 'Classic Beep',
    description: 'Triple digital beep — the timeless alarm',
    source: require('../../assets/sounds/classic_beep.wav'),
  },
  {
    id: 'mechanical_bell',
    name: 'Mechanical Bell',
    description: 'A ringing old-school alarm bell',
    source: require('../../assets/sounds/mechanical_bell.wav'),
  },
  {
    id: 'gentle_chimes',
    name: 'Gentle Chimes',
    description: 'Soft arpeggiated chimes — an easy rise',
    source: require('../../assets/sounds/gentle_chimes.wav'),
  },
  {
    id: 'warble_siren',
    name: 'Warble Siren',
    description: 'A rising/falling two-tone siren',
    source: require('../../assets/sounds/warble_siren.wav'),
  },
  {
    id: 'digital_pulse',
    name: 'Digital Pulse',
    description: 'Fast, urgent arcade-style pulse',
    source: require('../../assets/sounds/digital_pulse.wav'),
  },
  {
    id: 'morning_glow',
    name: 'Morning Glow',
    description: 'A soft melodic rise to ease you awake',
    source: require('../../assets/sounds/morning-clock-alarm.wav'),
  },
  {
    id: 'stardust',
    name: 'Stardust',
    description: 'Dreamy, twinkling tones — a gentle lift',
    source: require('../../assets/sounds/star-dust-alarm-clock.mp3'),
  },
  {
    id: 'melody',
    name: 'Melody',
    description: 'A warm musical phrase — the classic wake-up',
    source: require('../../assets/sounds/musical_alarm.mp3'),
  },
  {
    id: 'chime_up',
    name: 'Chime Up',
    description: 'A short, bright melodic chime',
    source: require('../../assets/sounds/musical-alarm.mp3'),
  },
  {
    id: 'chiptune',
    name: 'Chiptune',
    description: 'Retro 8-bit arcade wake-up',
    source: require('../../assets/sounds/chiptune-alarm-clock.mp3'),
  },
  {
    id: 'digital_buzzer',
    name: 'Digital Buzzer',
    description: 'Insistent digital buzz — hard to ignore',
    source: require('../../assets/sounds/digital-alarm-buzzer.wav'),
  },
  {
    id: 'red_alert',
    name: 'Red Alert',
    description: 'Relentless emergency siren — you WILL get up',
    source: require('../../assets/sounds/retro-game-emergency-alarm.wav'),
  },
];

/** The fallback tone — also the value stored as the DB defaults. */
export const DEFAULT_SOUND_ID = 'sunrise';

const SOUND_BY_ID = new Map(ALARM_SOUNDS.map((s) => [s.id, s]));

/** Look up a sound by id, falling back to the default if unknown/null. */
export function getAlarmSound(id?: string | null): AlarmSound {
  return (id && SOUND_BY_ID.get(id)) || SOUND_BY_ID.get(DEFAULT_SOUND_ID)!;
}

/** Resolve the bundled asset for an id (falls back to the default tone). */
export function getSoundSource(id?: string | null): number {
  return getAlarmSound(id).source;
}

// ── Preview playback (for the pickers) ───────────────────────────────────
// A single short-lived player so tapping through the list never stacks tones.

let previewPlayer: AudioPlayer | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

/** Play a short, non-looping preview of a sound. Used by the sound pickers. */
export async function previewSound(id: string, durationMs = 3500): Promise<void> {
  stopPreview();
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {}
  try {
    previewPlayer = createAudioPlayer(getSoundSource(id));
    previewPlayer.loop = false;
    previewPlayer.volume = 1.0;
    previewPlayer.play();
    previewTimer = setTimeout(stopPreview, durationMs);
  } catch {
    previewPlayer = null;
  }
}

/** Stop any in-progress preview and release the player. */
export function stopPreview(): void {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  if (previewPlayer) {
    try {
      previewPlayer.pause();
      previewPlayer.remove();
    } catch {}
    previewPlayer = null;
  }
}
