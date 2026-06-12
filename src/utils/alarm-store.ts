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
      id: alarm.id,
      date: target.toISOString(),
      title: alarm.label,
      launchAppOnDismiss: true,
      launchAppOnSnooze: false,
      doSnoozeIntent: true,
      snoozeDuration: 540,
    });
  } else {
    safeAlarmKit.scheduleRepeatingAlarm({
      id: alarm.id,
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

let alarmsInMemory: Alarm[] = [...INITIAL_ALARMS];
let listeners: (() => void)[] = [];

export const alarmStore = {
  getAlarms() {
    const native = safeAlarmKit.getAllAlarms();
    if (native && native.length > 0) {
      // Merge to preserve challenge structures which are only kept in JS memory
      alarmsInMemory = native.map((na) => {
        const existing = alarmsInMemory.find((a) => a.id === na.id);
        return {
          id: na.id,
          hour: na.hour,
          minute: na.minute,
          label: na.label,
          days: na.days,
          challenge: existing ? existing.challenge : na.challenge,
          enabled: na.enabled,
          isOneTime: na.isOneTime,
        };
      });
    }
    return alarmsInMemory;
  },

  addAlarm(alarmData: Omit<Alarm, 'id'>) {
    const id = generateUUID();
    const isOneTime = !alarmData.days || alarmData.days.length === 0;
    const newAlarm: Alarm = {
      id,
      ...alarmData,
      isOneTime,
    };
    alarmsInMemory.push(newAlarm);
    if (newAlarm.enabled) {
      scheduleAlarmNative(newAlarm);
    }
    safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
    this.notify();
    return newAlarm;
  },

  toggleAlarm(id: string) {
    alarmsInMemory = alarmsInMemory.map((a) => {
      if (a.id === id) {
        const nextEnabled = !a.enabled;
        const updated = { ...a, enabled: nextEnabled };
        if (nextEnabled) {
          scheduleAlarmNative(updated);
        } else {
          safeAlarmKit.cancelAlarm(id);
        }
        return updated;
      }
      return a;
    });
    safeAlarmKit.updateWidgetSnapshot(alarmsInMemory);
    this.notify();
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
