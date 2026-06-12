import { db } from '@/db/db';
import { alarms as alarmsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as ExpoHaptics from 'expo-haptics';

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
};

export const INITIAL_ALARMS: Alarm[] = [
  {
    id: '1',
    hour: 6,
    minute: 30,
    label: 'Weekday wake-up',
    days: [1, 2, 3, 4, 5],
    challenge: { glyph: '÷', label: 'SOLVE 3 EQUATIONS' },
    enabled: true,
  },
  {
    id: '2',
    hour: 7,
    minute: 45,
    label: 'Slow morning',
    days: [0, 6],
    challenge: { glyph: '≈', label: 'SHAKE × 20' },
    enabled: true,
  },
  {
    id: '3',
    hour: 14,
    minute: 15,
    label: 'Afternoon reset',
    days: [1, 3, 5],
    challenge: { glyph: '◫', label: 'PATTERN RECALL' },
    enabled: false,
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
    console.log("[Test] safeAlarmKit.scheduleAlarm called. NativeAlarmKit:", NativeAlarmKit);
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
  getAllAlarms: (): Alarm[] => {
    try {
      if (NativeAlarmKit?.getAllAlarms) {
        const native = NativeAlarmKit.getAllAlarms();
        if (native && native.length > 0) {
          return native.map((a: any) => ({
            id: a.id,
            hour: a.hour ?? 7,
            minute: a.minute ?? 0,
            label: a.title ?? 'Alarm',
            days: a.weekdays ?? [],
            challenge: { glyph: '÷', label: 'SOLVE 3 EQUATIONS' }, // default challenge
            enabled: true,
            isOneTime: a.type === 'one-time',
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
  math: { glyph: '÷', label: 'SOLVE 3 EQUATIONS' },
  shake: { glyph: '≈', label: 'SHAKE × 20' },
  pattern: { glyph: '◫', label: 'PATTERN RECALL' },
  steps: { glyph: '∴', label: 'STEPS × 15' },
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
  };
}

export function getChallengeId(challenge: { glyph: string; label: string }): 'math' | 'shake' | 'pattern' | 'steps' {
  if (challenge.glyph === '≈') return 'shake';
  if (challenge.glyph === '◫') return 'pattern';
  if (challenge.glyph === '∴') return 'steps';
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
        
        const challengeId = getChallengeId(native.challenge || { glyph: '÷', label: 'SOLVE 3 EQUATIONS' });
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
      console.log('Seeding initial alarms into SQLite...');
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
