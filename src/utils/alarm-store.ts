import { db } from '@/db/db';
import {
  alarmEvents,
  alarms as alarmsTable,
  ChallengeType,
  Difficulty,
  EventOutcome,
  streakDays,
  streakState
} from '@/db/schema';
import { stopAlarmSound } from '@/utils/alarm-sound';
import { eq } from 'drizzle-orm';
import { File, Paths } from 'expo-file-system';
import * as ExpoHaptics from 'expo-haptics';

// ── Pending-alarm persistence (survives force-quit) ──────────────────
// Uses a small JSON file rather than a DB row so it can be read
// synchronously-ish on cold launch before migrations finish.

type PendingAlarmData = {
  alarmId: string;
  challenge: string;
  difficulty: 'gentle' | 'standard' | 'brutal';
  soundId?: string | null;
};

const pendingFile = new File(Paths.document, 'pending_alarm.json');

/** Persist that an alarm is unmet. */
export function markAlarmPending(data: PendingAlarmData): void {
  try {
    pendingFile.write(JSON.stringify(data));
  } catch {}
}

/** Clear the pending alarm flag (challenge was completed). */
export function clearAlarmPending(): void {
  try {
    if (pendingFile.exists) {
      pendingFile.delete();
    }
  } catch {}
}

/** Read the pending alarm flag — null if nothing pending. */
export async function getPendingAlarm(): Promise<PendingAlarmData | null> {
  try {
    if (!pendingFile.exists) return null;
    const raw = pendingFile.textSync();
    return JSON.parse(raw) as PendingAlarmData;
  } catch {
    return null;
  }
}

/**
 * Stop the alarm sound + haptics + end the system alarm/notification.
 * The ONLY authorised call site is ActiveAlarmOverlay.handleComplete.
 */
export function stopAlarm(alarmId?: string): void {
  // The real alarm experience is the in-app sound — silence it first. This is
  // the gate's payoff: it only happens on challenge success.
  try {
    stopAlarmSound();
  } catch {}
  try {
    // Stop the native alarm too (best-effort; the system may have already
    // stopped it when the user tapped Dismiss to launch the app).
    if (alarmId) safeAlarmKit.stopAlarm(alarmId);
  } catch {}
  try {
    safeSnoozeActivity.endAll();
  } catch {}
}

// Safe wrapper for environments where ExpoHaptics isn't fully linked
export const Haptics = {
  impactAsync: async (style: ExpoHaptics.ImpactFeedbackStyle) => {
    try {
      await ExpoHaptics.impactAsync(style);
    } catch {
      // Haptics not available in this build
    }
  },
  notificationAsync: async (type: ExpoHaptics.NotificationFeedbackType) => {
    try {
      await ExpoHaptics.notificationAsync(type);
    } catch {
      // Haptics not available in this build
    }
  },
  ImpactFeedbackStyle: ExpoHaptics.ImpactFeedbackStyle,
  NotificationFeedbackType: ExpoHaptics.NotificationFeedbackType,
};

// Safe wrapper for AlarmKit in case it's not compiled or available in this build
let NativeAlarmKit: any = null;
try {
  NativeAlarmKit = require('../../modules/expo-alarm-kit');
} catch {
  console.log('ExpoAlarmKit native module not available in this environment');
}

// Safe wrapper for widgets/Live Activity
let widgetsModule: any = null;
try {
  widgetsModule = require('../../widgets');
} catch {
  console.log('Widgets module not available in this environment');
}

const APP_GROUP_ID = 'group.com.tsouvili.wakey';

// A fixed UUID reserved for the native "nag" re-fires (see alarm-nag.ts). It is
// deliberately OUTSIDE the dbIdToUUID scheme so uuidToDbId() returns null for
// it, and it must never be treated as a real user alarm. Defined here (rather
// than in alarm-nag.ts) so this module can filter it out without a circular
// import — alarm-nag depends on alarm-store, not the other way around.
export const NAG_ALARM_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

export type Challenge = { glyph: string; label: string };

export type Alarm = {
  id: string;
  hour: number; // 24h
  minute: number;
  label: string;
  days: number[]; // 0 = Sun, empty = one-time
  challenge: Challenge;
  enabled: boolean;
  isOneTime?: boolean; // true for one-time alarms (no repeat days)
  difficulty: Difficulty;
  soundId?: string | null; // null → fall back to the default tone
};

export const INITIAL_ALARMS: Alarm[] = [
  {
    id: '1',
    hour: 6,
    minute: 30,
    label: 'Weekday wake-up',
    days: [1, 2, 3, 4, 5],
    challenge: { glyph: '÷', label: 'SOLVE EQUATIONS' },
    enabled: true,
    difficulty: 'standard',
  },
  {
    id: '2',
    hour: 7,
    minute: 45,
    label: 'Slow morning',
    days: [0, 6],
    challenge: { glyph: '≈', label: 'SHAKE' },
    enabled: true,
    difficulty: 'standard',
  },
  {
    id: '3',
    hour: 14,
    minute: 15,
    label: 'Afternoon reset',
    days: [1, 3, 5],
    challenge: { glyph: '◫', label: 'PATTERN RECALL' },
    enabled: false,
    difficulty: 'standard',
  },
];

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function dbIdToUUID(id: string | number): string {
  const hex = Number(id).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

export function uuidToDbId(uuid: string): number | null {
  if (uuid.startsWith('00000000-0000-4000-8000-')) {
    const hex = uuid.split('-').pop();
    if (hex) return parseInt(hex, 16);
  }
  return null;
}

export const safeAlarmKit = {
  configure: () => {
    try {
      if (NativeAlarmKit?.configure) {
        NativeAlarmKit.configure(APP_GROUP_ID);
      }
    } catch {}
  },
  requestAuthorization: () => {
    try {
      if (NativeAlarmKit?.requestAuthorization) {
        return NativeAlarmKit.requestAuthorization().catch(() => 'denied');
      }
    } catch {}
    return Promise.resolve('denied');
  },
  scheduleAlarm: (options: any) => {
    try {
      if (NativeAlarmKit?.scheduleAlarm) {
        return NativeAlarmKit.scheduleAlarm(options).catch((err: any) => {
          console.error("[Test] NativeAlarmKit.scheduleAlarm native call rejected with:", err);
          return false;
        });
      } else {
        console.warn("[Test] NativeAlarmKit.scheduleAlarm is undefined!");
      }
    } catch (e: any) {
      console.error("[Test] safeAlarmKit.scheduleAlarm exception:", e);
    }
    return Promise.resolve(false);
  },
  scheduleRepeatingAlarm: (options: any) => {
    try {
      if (NativeAlarmKit?.scheduleRepeatingAlarm) {
        return NativeAlarmKit.scheduleRepeatingAlarm(options).catch(() => false);
      }
    } catch {}
    return Promise.resolve(false);
  },
  cancelAlarm: (id: string) => {
    try {
      if (NativeAlarmKit?.cancelAlarm) {
        return NativeAlarmKit.cancelAlarm(id).catch(() => false);
      }
    } catch {}
    return Promise.resolve(false);
  },
  stopAlarm: (id: string) => {
    try {
      if (NativeAlarmKit?.stopAlarm) {
        return NativeAlarmKit.stopAlarm(id).catch(() => false);
      }
    } catch {}
    return Promise.resolve(false);
  },
  getAllAlarms: (): Alarm[] => {
    try {
      if (NativeAlarmKit?.getAllAlarms) {
        const native = (NativeAlarmKit.getAllAlarms() as any[] | undefined)?.filter(
          (a: any) => a?.id !== NAG_ALARM_ID,
        );
        if (native && native.length > 0) {
          return native.map((a: any) => ({
            id: a.id,
            hour: a.hour ?? 7,
            minute: a.minute ?? 0,
            label: a.title ?? 'Alarm',
            days: a.weekdays ?? [],
            challenge: CHALLENGE_MAPPING[a.challengeId as string] || CHALLENGE_MAPPING.math,
            enabled: true,
            isOneTime: a.type === 'one-time',
            difficulty: (a.difficulty as Difficulty) || 'standard',
          }));
        }
      }
    } catch {}
    return [];
  },
  getLaunchPayload: () => {
    try {
      if (NativeAlarmKit?.getLaunchPayload) {
        return NativeAlarmKit.getLaunchPayload();
      }
    } catch {}
    return null;
  },
  addLaunchPayloadListener: (listener: (event: any) => void) => {
    try {
      if (NativeAlarmKit?.addLaunchPayloadListener) {
        return NativeAlarmKit.addLaunchPayloadListener(listener);
      }
    } catch {}
    return { remove: () => {} };
  },
  updateWidgetSnapshot: (activeAlarms: any[]) => {
    try {
      if (widgetsModule?.nextAlarmWidget?.updateSnapshot) {
        if (activeAlarms.length === 0) {
          widgetsModule.nextAlarmWidget.updateSnapshot({ title: '', timeString: '', hasAlarm: false });
          return;
        }
        
        let nextAlarm = null;
        let nextAlarmDate = null;
        const now = new Date();
        
        for (const alarm of activeAlarms) {
          if (!alarm.enabled) continue;
          
          let next = new Date();
          next.setHours(alarm.hour, alarm.minute, 0, 0);
          let minDiff = Infinity;
          let bestDate = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          const days = alarm.days && alarm.days.length > 0 ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
          for (const day of days) {
            const currentDay = now.getDay();
            let diff = day - currentDay;
            if (diff < 0 || (diff === 0 && now.getTime() >= next.getTime())) {
              diff += 7;
            }
            const targetDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
            targetDate.setHours(alarm.hour, alarm.minute, 0, 0);
            const targetDiff = targetDate.getTime() - now.getTime();
            if (targetDiff < minDiff) {
              minDiff = targetDiff;
              bestDate = targetDate;
            }
          }
          
          if (!nextAlarmDate || bestDate.getTime() < nextAlarmDate.getTime()) {
            nextAlarmDate = bestDate;
            nextAlarm = alarm;
          }
        }
        
        if (nextAlarm && nextAlarmDate) {
          const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
          const formattedTime = nextAlarmDate.toLocaleTimeString('en-US', options);
          widgetsModule.nextAlarmWidget.updateSnapshot({
            title: nextAlarm.label,
            timeString: formattedTime,
            hasAlarm: true,
          });
        } else {
          widgetsModule.nextAlarmWidget.updateSnapshot({ title: '', timeString: '', hasAlarm: false });
        }
      }
    } catch {}
  }
};

export const safeSnoozeActivity = {
  start: (props: { fireDate: number; title: string }) => {
    try {
      if (widgetsModule?.snoozeCountdownActivity?.start) {
        widgetsModule.snoozeCountdownActivity.start(props);
      }
    } catch {}
  },
  endAll: () => {
    try {
      if (widgetsModule?.snoozeCountdownActivity?.getInstances) {
        const instances = widgetsModule.snoozeCountdownActivity.getInstances();
        for (const inst of instances) {
          inst.end('immediate');
        }
      }
    } catch {}
  },
};

export function scheduleAlarmNative(alarm: Alarm) {
  const isOneTime = alarm.isOneTime || !alarm.days || alarm.days.length === 0;

  if (isOneTime) {
    const now = new Date();
    const target = new Date();
    target.setHours(alarm.hour, alarm.minute, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    safeAlarmKit.scheduleAlarm({
      id: dbIdToUUID(alarm.id),
      date: target.toISOString(),
      title: alarm.label,
      launchAppOnDismiss: true,
      launchAppOnSnooze: false,
      doSnoozeIntent: true,
      snoozeDuration: 540,
    });
  } else {
    safeAlarmKit.scheduleRepeatingAlarm({
      id: dbIdToUUID(alarm.id),
      hour: alarm.hour,
      minute: alarm.minute,
      weekdays: alarm.days,
      title: alarm.label,
      launchAppOnDismiss: true,
      launchAppOnSnooze: false,
      doSnoozeIntent: true,
      snoozeDuration: 540,
    });
  }
}

export const CHALLENGE_MAPPING: Record<string, { glyph: string; label: string }> = {
  math: { glyph: '÷', label: 'SOLVE EQUATIONS' },
  shake: { glyph: '≈', label: 'SHAKE' },
  pattern: { glyph: '◫', label: 'PATTERN RECALL' },
  steps: { glyph: '∴', label: 'STEPS' },
  pushups: { glyph: '⤓', label: 'PUSH-UPS' },
  squats: { glyph: '⇕', label: 'SQUATS' },
  photo: { glyph: '◎', label: 'SKY PHOTO' },
  scan: { glyph: '⊡', label: 'CODE HUNT' },
  'find-item': { glyph: '⊡', label: 'FIND AN ITEM' },
  bed: { glyph: '▭', label: 'MAKE YOUR BED' },
  meds: { glyph: '✚', label: 'MEDICATION' },
};

export function mapDbToUiAlarm(dbAlarm: any): Alarm {
  const challengeId = dbAlarm.challenge || 'math';
  const mappedChallenge = CHALLENGE_MAPPING[challengeId] || CHALLENGE_MAPPING.math;
  
  let parsedDays = dbAlarm.days;
  if (typeof parsedDays === 'string') {
    try { parsedDays = JSON.parse(parsedDays); }
    catch { parsedDays = []; }
  } else if (!parsedDays) {
    parsedDays = [];
  }

  return {
    id: String(dbAlarm.id),
    hour: dbAlarm.hour,
    minute: dbAlarm.minute,
    label: dbAlarm.label,
    days: parsedDays,
    challenge: mappedChallenge,
    enabled: !!dbAlarm.enabled,
    isOneTime: !parsedDays || parsedDays.length === 0,
    difficulty: (dbAlarm.difficulty as Difficulty) || 'standard',
    soundId: dbAlarm.soundId ?? null,
  };
}

export function getChallengeId(challenge: { glyph: string; label: string }): ChallengeType {
  // First try a direct reverse lookup by matching both glyph and label
  for (const [id, mapping] of Object.entries(CHALLENGE_MAPPING)) {
    if (mapping.glyph === challenge.glyph && mapping.label === challenge.label) {
      return id as ChallengeType;
    }
  }
  // Fall back to glyph-only matching for legacy data
  if (challenge.glyph === '≈') return 'shake';
  if (challenge.glyph === '◫') return 'pattern';
  if (challenge.glyph === '∴') return 'steps';
  if (challenge.glyph === '⤓') return 'pushups';
  if (challenge.glyph === '⇕') return 'squats';
  if (challenge.glyph === '◎') return 'photo';
  if (challenge.glyph === '▭') return 'bed';
  if (challenge.glyph === '✚') return 'meds';
  if (challenge.glyph === '⊡') {
    if (challenge.label.toUpperCase().includes('FIND')) return 'find-item';
    return 'scan';
  }
  return 'math';
}

let alarmsInMemory: Alarm[] = [];
let listeners: (() => void)[] = [];

export async function initAlarmsFromDb() {
  try {
    const dbAlarms = await db.select().from(alarmsTable);
    alarmsInMemory = dbAlarms.map(mapDbToUiAlarm);
    safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
  } catch (error) {
    console.error('Error loading alarms from database:', error);
  }
}

export async function syncWithNativeState() {
  try {
    const nativeAlarms = safeAlarmKit.getAllAlarms();
    if (!nativeAlarms || nativeAlarms.length === 0) return;

    for (const native of nativeAlarms) {
      const numericId = uuidToDbId(native.id);
      if (numericId === null) {
        // Legacy UUID alarm found! Cancel it and migrate to DB.
        safeAlarmKit.cancelAlarm(native.id);
        
        const challengeId = getChallengeId(native.challenge || CHALLENGE_MAPPING.math);
        const [inserted] = await db.insert(alarmsTable).values({
          hour: native.hour,
          minute: native.minute,
          label: native.label || 'Alarm',
          days: native.days || [],
          challenge: challengeId,
          difficulty: 'standard',
          enabled: native.enabled,
        }).returning();

        if (inserted && native.enabled) {
          scheduleAlarmNative(mapDbToUiAlarm(inserted));
        }
        continue;
      }

      await db
        .update(alarmsTable)
        .set({ enabled: native.enabled })
        .where(eq(alarmsTable.id, numericId));
    }
    await initAlarmsFromDb();
  } catch (error) {
    console.error('Error syncing with native state:', error);
  }
}

export async function seedInitialAlarmsIfEmpty() {
  try {
    const existing = await db.select().from(alarmsTable);
    if (existing.length === 0) {
      for (const initAlarm of INITIAL_ALARMS) {
        const challengeId = getChallengeId(initAlarm.challenge);
        const [inserted] = await db.insert(alarmsTable).values({
          hour: initAlarm.hour,
          minute: initAlarm.minute,
          label: initAlarm.label,
          days: initAlarm.days,
          challenge: challengeId,
          difficulty: 'standard',
          enabled: initAlarm.enabled,
        }).returning();

        if (initAlarm.enabled && inserted) {
          scheduleAlarmNative(mapDbToUiAlarm(inserted));
        }
      }
    }
    await initAlarmsFromDb();
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
export const alarmStore = {
  getAlarms() {
    return alarmsInMemory;
  },

  async addAlarm(alarmData: Omit<Alarm, 'id'> & { difficulty?: 'gentle' | 'standard' | 'brutal' }) {
    const challengeId = getChallengeId(alarmData.challenge);
    const [inserted] = await db.insert(alarmsTable).values({
      hour: alarmData.hour,
      minute: alarmData.minute,
      label: alarmData.label,
      days: alarmData.days,
      challenge: challengeId,
      difficulty: alarmData.difficulty || 'standard',
      soundId: alarmData.soundId ?? null,
      enabled: true,
    }).returning();

    if (!inserted) {
      throw new Error("Failed to save alarm to database");
    }

    const newAlarm = mapDbToUiAlarm(inserted);
    if (newAlarm.enabled) {
      scheduleAlarmNative(newAlarm);
    }
    
    alarmsInMemory.push(newAlarm);
    safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
    this.notify();
    return newAlarm;
  },

  async updateAlarm(id: string, alarmData: Omit<Alarm, 'id'> & { difficulty?: 'gentle' | 'standard' | 'brutal' }) {
    try {
      const challengeId = getChallengeId(alarmData.challenge);
      const numericId = Number(id);

      // Cancel the scheduled native alarm first so it can't fire as an orphan
      await safeAlarmKit.cancelAlarm(dbIdToUUID(id));

      await db
        .update(alarmsTable)
        .set({
          hour: alarmData.hour,
          minute: alarmData.minute,
          label: alarmData.label,
          days: alarmData.days,
          challenge: challengeId,
          difficulty: alarmData.difficulty || 'standard',
          soundId: alarmData.soundId ?? null,
          enabled: true, // Auto-enable on edit
        })
        .where(eq(alarmsTable.id, numericId));

      const [updated] = await db.select().from(alarmsTable).where(eq(alarmsTable.id, numericId));
      if (!updated) {
        throw new Error("Failed to update alarm in database");
      }

      const updatedAlarm = mapDbToUiAlarm(updated);
      if (updatedAlarm.enabled) {
        scheduleAlarmNative(updatedAlarm);
      }

      alarmsInMemory = alarmsInMemory.map((a) => (a.id === id ? updatedAlarm : a));
      safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
      this.notify();
      return updatedAlarm;
    } catch (error) {
      console.error('[alarmStore.updateAlarm] Error updating alarm:', error);
      throw error;
    }
  },

  async toggleAlarm(id: string) {
    try {
      const numericId = Number(id);
      const [alarm] = await db.select().from(alarmsTable).where(eq(alarmsTable.id, numericId));
      if (!alarm) return;

      const nextEnabled = !alarm.enabled;
      await db
        .update(alarmsTable)
        .set({ enabled: nextEnabled })
        .where(eq(alarmsTable.id, numericId));

      // Fetch the updated row manually since .returning() might not be fully supported by the underlying driver
      const [updated] = await db.select().from(alarmsTable).where(eq(alarmsTable.id, numericId));

      if (updated) {
        const uiAlarm = mapDbToUiAlarm(updated);
        if (nextEnabled) {
          scheduleAlarmNative(uiAlarm);
        } else {
          await safeAlarmKit.cancelAlarm(dbIdToUUID(id));
        }

        alarmsInMemory = alarmsInMemory.map((a) => (a.id === id ? uiAlarm : a));
        safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
        this.notify();
      }
    } catch (error) {
      console.error('[alarmStore.toggleAlarm] Error toggling alarm:', error);
    }
  },

  async deleteAlarm(id: string) {
    try {
      const numericId = Number(id);
      // Cancel the scheduled native alarm first so it can't fire as an orphan
      await safeAlarmKit.cancelAlarm(dbIdToUUID(id));
      await db.delete(alarmsTable).where(eq(alarmsTable.id, numericId));

      alarmsInMemory = alarmsInMemory.filter((a) => a.id !== id);
      safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
      this.notify();
    } catch (error) {
      console.error('[alarmStore.deleteAlarm] Error deleting alarm:', error);
    }
},

  subscribe(listener: () => void) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  notify() {
    listeners.forEach((l) => l());
  },
};

export function getLocalDayStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function resolveAlarmAndRecord({
  alarmId,
  challenge,
  difficulty,
  firedAt,
  outcome,
  attempts,
  snoozeCount,
}: {
  alarmId: string;
  challenge: ChallengeType;
  difficulty: Difficulty;
  firedAt: Date;
  outcome: EventOutcome;
  attempts: number;
  snoozeCount: number;
}) {
  const resolvedAt = new Date();
  const durationMs = resolvedAt.getTime() - firedAt.getTime();
  const localDay = getLocalDayStr(resolvedAt);
  const numericAlarmId = uuidToDbId(alarmId);

  // 1. Stop the alarm natively
  await safeAlarmKit.stopAlarm(alarmId);

  // 2. End Live Activities
  safeSnoozeActivity.endAll();

  // 3. Write alarm event
  await db.insert(alarmEvents).values({
    alarmId: numericAlarmId,
    challenge,
    difficulty,
    firedAt,
    resolvedAt,
    outcome,
    durationMs,
    snoozeCount,
    attempts,
    localDay,
  });

  // 4. Update streaks if the outcome counts toward the streak
  if (outcome === 'dismissed' || outcome === 'dismissed_assisted') {
    // Check if streak_days already has this day
    const [existingDay] = await db
      .select()
      .from(streakDays)
      .where(eq(streakDays.day, localDay));

    if (existingDay) {
      await db
        .update(streakDays)
        .set({
          beatenCount: existingDay.beatenCount + 1,
        })
        .where(eq(streakDays.day, localDay));
    } else {
      await db.insert(streakDays).values({
        day: localDay,
        beatenCount: 1,
        firstBeatenAt: resolvedAt,
      });
    }

    // Now recalculate streak_state
    const allDays = await db.select().from(streakDays);
    const sortedEpochDays = allDays
      .map((d) => {
        const [y, mStr, dayNum] = d.day.split('-').map(Number);
        const date = new Date(y, mStr - 1, dayNum);
        return Math.round(date.getTime() / (24 * 60 * 60 * 1000));
      })
      .sort((a, b) => a - b);

    const uniqueEpochDays = Array.from(new Set(sortedEpochDays));

    let longestStreak = 0;
    let tempStreak = 0;
    let prevDay = null;

    for (const epDay of uniqueEpochDays) {
      if (prevDay === null) {
        tempStreak = 1;
      } else if (epDay === prevDay + 1) {
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 1;
      }
      prevDay = epDay;
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    // Calculate current streak
    let currentStreak = 0;
    const todayEpoch = Math.round(new Date(resolvedAt.getFullYear(), resolvedAt.getMonth(), resolvedAt.getDate()).getTime() / (24 * 60 * 60 * 1000));
    
    if (uniqueEpochDays.length > 0) {
      const lastEpDay = uniqueEpochDays[uniqueEpochDays.length - 1];
      if (lastEpDay === todayEpoch || lastEpDay === todayEpoch - 1) {
        currentStreak = 1;
        for (let i = uniqueEpochDays.length - 2; i >= 0; i--) {
          if (uniqueEpochDays[i] === uniqueEpochDays[i + 1] - 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    const totalBeaten = allDays.reduce((acc, d) => acc + d.beatenCount, 0);

    // Upsert streak_state
    const [existingState] = await db.select().from(streakState).where(eq(streakState.id, 1));
    if (existingState) {
      await db
        .update(streakState)
        .set({
          currentStreak,
          longestStreak: Math.max(existingState.longestStreak, longestStreak),
          lastBeatenDay: localDay,
          totalBeaten,
          updatedAt: new Date(),
        })
        .where(eq(streakState.id, 1));
    } else {
      await db.insert(streakState).values({
        id: 1,
        currentStreak,
        longestStreak,
        lastBeatenDay: localDay,
        totalBeaten,
        updatedAt: new Date(),
      });
    }
  }
}

export async function clearAllDatabaseData() {
  await db.delete(alarmEvents);
  await db.delete(streakDays);
  await db.delete(streakState);
  await db.delete(alarmsTable);
}

export async function seedDemoInsightsData() {
  // 1. Clear existing history first
  await db.delete(alarmEvents);
  await db.delete(streakDays);
  await db.delete(streakState);

  const now = new Date();
  const daysToSeed = 70;
  const challengeTypes: ChallengeType[] = ['math', 'shake', 'pattern', 'steps', 'pushups', 'squats', 'photo', 'scan', 'find-item', 'bed', 'meds'];

  // Keep track of which days we beat alarms
  const beatenDays: { date: Date; localDay: string; count: number; firstBeatenAt: Date }[] = [];

  for (let i = daysToSeed; i >= 0; i--) {
    const seedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const localDay = getLocalDayStr(seedDate);

    // 80% chance to beat alarm on a weekday, 60% on weekends
    const dayOfWeek = seedDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const probability = isWeekend ? 0.65 : 0.85;

    if (Math.random() < probability) {
      // 1 or 2 alarms beaten on this day
      const count = Math.random() < 0.25 ? 2 : 1;
      let firstBeatenAt: Date | null = null;

      for (let c = 0; c < count; c++) {
        // Earliest alarm at e.g. 7:00 AM or 7:30 AM
        const hour = isWeekend ? 8 : 7;
        const minute = Math.floor(Math.random() * 30); // 0 to 29
        const firedAt = new Date(seedDate.getFullYear(), seedDate.getMonth(), seedDate.getDate(), hour, minute, 0);

        const challenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
        const difficulty = (['gentle', 'standard', 'brutal'] as const)[Math.floor(Math.random() * 3)];
        
        // 20% chance of snoozing
        const hasSnoozed = Math.random() < 0.2;
        const snoozeCount = hasSnoozed ? Math.floor(Math.random() * 2) + 1 : 0;
        
        // duration: if snoozed, takes longer (e.g. 9 mins per snooze + 30-90s challenge)
        // if not snoozed, takes 15-80 seconds
        const snoozeTimeMs = snoozeCount * 9 * 60 * 1000;
        const solveTimeMs = Math.floor(Math.random() * 65000) + 15000;
        const durationMs = snoozeTimeMs + solveTimeMs;
        const resolvedAt = new Date(firedAt.getTime() + durationMs);

        if (!firstBeatenAt || resolvedAt < firstBeatenAt) {
          firstBeatenAt = resolvedAt;
        }

        // Write alarm event
        await db.insert(alarmEvents).values({
          challenge,
          difficulty,
          firedAt,
          resolvedAt,
          outcome: 'dismissed',
          durationMs,
          snoozeCount,
          attempts: Math.floor(Math.random() * 2) + 1,
          localDay,
        });
      }

      if (firstBeatenAt) {
        beatenDays.push({
          date: seedDate,
          localDay,
          count: count,
          firstBeatenAt,
        });

        // Insert into streakDays
        await db.insert(streakDays).values({
          day: localDay,
          beatenCount: count,
          firstBeatenAt,
        });
      }
    } else {
      // missed/missed-alarm event occasionally to make it realistic
      if (Math.random() < 0.3) {
        const hour = isWeekend ? 8 : 7;
        const minute = Math.floor(Math.random() * 30);
        const firedAt = new Date(seedDate.getFullYear(), seedDate.getMonth(), seedDate.getDate(), hour, minute, 0);
        const challenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
        
        await db.insert(alarmEvents).values({
          challenge,
          difficulty: 'standard',
          firedAt,
          outcome: 'missed',
          localDay,
        });
      }
    }
  }

  // Now calculate current and longest streaks based on beatenDays
  const sortedEpochDays = beatenDays
    .map((d) => {
      const [y, mStr, dayNum] = d.localDay.split('-').map(Number);
      const date = new Date(y, mStr - 1, dayNum);
      return Math.round(date.getTime() / (24 * 60 * 60 * 1000));
    })
    .sort((a, b) => a - b);

  const uniqueEpochDays = Array.from(new Set(sortedEpochDays));

  let longestStreak = 0;
  let tempStreak = 0;
  let prevDay = null;

  for (const epDay of uniqueEpochDays) {
    if (prevDay === null) {
      tempStreak = 1;
    } else if (epDay === prevDay + 1) {
      tempStreak++;
    } else {
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      tempStreak = 1;
    }
    prevDay = epDay;
  }
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  let currentStreak = 0;
  const todayEpoch = Math.round(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / (24 * 60 * 60 * 1000));

  if (uniqueEpochDays.length > 0) {
    const lastEpDay = uniqueEpochDays[uniqueEpochDays.length - 1];
    if (lastEpDay === todayEpoch || lastEpDay === todayEpoch - 1) {
      currentStreak = 1;
      for (let i = uniqueEpochDays.length - 2; i >= 0; i--) {
        if (uniqueEpochDays[i] === uniqueEpochDays[i + 1] - 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }
  }

  const totalBeaten = beatenDays.reduce((acc, d) => acc + d.count, 0);
  const lastBeatenDayStr = beatenDays.length > 0 ? beatenDays[beatenDays.length - 1].localDay : null;

  await db.insert(streakState).values({
    id: 1,
    currentStreak,
    longestStreak,
    lastBeatenDay: lastBeatenDayStr,
    totalBeaten,
    updatedAt: new Date(),
  });
}

