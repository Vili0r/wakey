/**
 * settings-store — thin read/write helpers for the singleton `settings` row.
 *
 * The settings table is keyed on a fixed id of 1. These helpers get-or-create
 * that row so callers never have to worry about whether it's been seeded yet.
 * Currently only the default alarm sound is wired through here; other prefs on
 * the Settings screen are still local-state placeholders.
 */

import { db } from '@/db/db';
import { settings as settingsTable } from '@/db/schema';
import { DEFAULT_SOUND_ID } from '@/utils/alarm-sounds';
import { eq } from 'drizzle-orm';

const SETTINGS_ID = 1;

/** Read the settings row, creating it with defaults if missing. */
async function getOrCreateSettings() {
  const [existing] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));
  if (existing) return existing;

  const [created] = await db
    .insert(settingsTable)
    .values({ id: SETTINGS_ID })
    .returning();
  return created;
}

/** The user's default alarm sound id (falls back to the registry default). */
export async function getDefaultSoundId(): Promise<string> {
  try {
    const row = await getOrCreateSettings();
    return row?.defaultSoundId ?? DEFAULT_SOUND_ID;
  } catch {
    return DEFAULT_SOUND_ID;
  }
}

/** Persist the user's default alarm sound id. */
export async function setDefaultSoundId(soundId: string): Promise<void> {
  try {
    await getOrCreateSettings();
    await db
      .update(settingsTable)
      .set({ defaultSoundId: soundId, updatedAt: new Date() })
      .where(eq(settingsTable.id, SETTINGS_ID));
  } catch {
    // best-effort; UI keeps its optimistic value
  }
}
