/**
 * persistence — the bridge between the in-memory onboarding answers and the
 * `settings` singleton row. Reading `getOnboardingComplete()` is what gates
 * the whole app (see app/index). `completeOnboarding()` is called once, from
 * the paywall, and is responsible for the durable flag + first-alarm prefill.
 */

import { db } from '@/db/db';
import { settings as settingsTable } from '@/db/schema';
import type { OnboardingState } from '@/onboarding/state';
import { alarmStore, CHALLENGE_MAPPING } from '@/utils/alarm-store';
import { eq } from 'drizzle-orm';

const SETTINGS_ID = 1;

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

/** Has the user finished onboarding? Defaults to false on any read error. */
export async function getOnboardingComplete(): Promise<boolean> {
  try {
    const row = await getOrCreateSettings();
    return !!row?.onboardingComplete;
  } catch {
    return false;
  }
}

/**
 * Persist the onboarding result: flip the flag, store the chosen wake time and
 * raw answers, and seed the user's first alarm so the home screen opens
 * populated. Best-effort — a DB hiccup must never strand the user on the
 * paywall, so failures are swallowed after logging.
 */
export async function completeOnboarding(state: OnboardingState): Promise<void> {
  try {
    await getOrCreateSettings();
    await db
      .update(settingsTable)
      .set({
        onboardingComplete: true,
        wakeHour: state.wakeHour,
        wakeMinute: state.wakeMinute,
        onboardingAnswers: {
          snooze: state.snooze,
          mornings: state.mornings,
          hardest: state.hardest,
          currentWake: state.currentWake,
          realMorning: state.realMorning,
          commitment: state.commitment,
          mission: state.mission,
        },
        updatedAt: new Date(),
      })
      .where(eq(settingsTable.id, SETTINGS_ID));

    await seedFirstAlarm(state);
  } catch (err) {
    console.error('[completeOnboarding] failed to persist onboarding:', err);
  }
}

/** Create the user's first alarm at their chosen wake time (weekdays). */
async function seedFirstAlarm(state: OnboardingState): Promise<void> {
  try {
    await alarmStore.addAlarm({
      hour: state.wakeHour,
      minute: state.wakeMinute,
      label: 'Wake up',
      days: [1, 2, 3, 4, 5],
      challenge: CHALLENGE_MAPPING[state.mission] || CHALLENGE_MAPPING.math,
      enabled: true,
      difficulty: 'standard',
    });
  } catch (err) {
    console.error('[completeOnboarding] failed to seed first alarm:', err);
  }
}
