/**
 * reminder — schedules the one notification the paywall must always set up: a
 * heads-up the day before the free trial ends, so a charge is never a surprise.
 * Best-effort and self-contained; if permission is denied we simply skip it.
 */

import * as Notifications from 'expo-notifications';

/** Length of the free trial, in days. */
export const TRIAL_DAYS = 3;

/**
 * Schedule a local notification ~1 day before the trial ends. Returns the
 * scheduled notification id, or null if it couldn't be scheduled (permission
 * denied, already elapsed, or error).
 */
export async function scheduleTrialEndReminder(): Promise<string | null> {
  try {
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    // Fire mid-morning, one day before the trial lapses.
    const fireDate = new Date();
    fireDate.setDate(fireDate.getDate() + (TRIAL_DAYS - 1));
    fireDate.setHours(10, 0, 0, 0);
    if (fireDate.getTime() <= Date.now()) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Wakey trial ends tomorrow',
        body: 'Loving your mornings? Keep the streak going — cancel anytime before then.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
  } catch (err) {
    console.error('[scheduleTrialEndReminder] failed:', err);
    return null;
  }
}
