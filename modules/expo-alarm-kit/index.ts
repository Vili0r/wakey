import { requireNativeModule, EventEmitter, Subscription } from 'expo';

const ExpoAlarmKit = requireNativeModule('ExpoAlarmKit');
const eventEmitter = new EventEmitter(ExpoAlarmKit);

export interface AlarmMetadata {
  id: string;
  title: string;
  type: 'one-time' | 'repeating';
  date?: string;       // ISO8601 formatted string (for one-time alarms)
  hour?: number;       // Hour 0-23 (for repeating alarms)
  minute?: number;     // Minute 0-59 (for repeating alarms)
  weekdays?: number[]; // Array of weekdays 0-6 (0 = Sunday, 1 = Monday, etc., for repeating alarms)
  soundName?: string;
  launchAppOnDismiss?: boolean;
  launchAppOnSnooze?: boolean;
  doSnoozeIntent?: boolean;
  snoozeDuration?: number;
  tintColor?: string; // hex string e.g. '#FF9900'
}

export interface OneTimeAlarmOptions {
  id: string;
  date: string; // ISO8601 formatted string
  title: string;
  soundName?: string;
  launchAppOnDismiss?: boolean;
  launchAppOnSnooze?: boolean;
  doSnoozeIntent?: boolean;
  snoozeDuration?: number; // snooze duration in seconds
  tintColor?: string; // hex string e.g. '#FF9900'
}

export interface RepeatingAlarmOptions {
  id: string;
  hour: number;
  minute: number;
  weekdays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  title: string;
  soundName?: string;
  launchAppOnDismiss?: boolean;
  launchAppOnSnooze?: boolean;
  doSnoozeIntent?: boolean;
  snoozeDuration?: number; // snooze duration in seconds
  tintColor?: string; // hex string e.g. '#FF9900'
}

export interface LaunchPayload {
  alarmId: string;
  payload: string; // 'dismiss' | 'snooze'
  fireDate?: string;
  title?: string;
}

/**
 * Configure the AlarmKit module with the App Group ID.
 * 
 * FLAG_APP_GROUP_ID_MATCHING:
 * Expected value: "group.com.tsouvili.wakey"
 * Used in:
 *   1. Entitlements (app.json) -> "com.apple.security.application-groups"
 *   2. configure() call (TypeScript/JavaScript app entry)
 *   3. UserDefaults suiteName (Swift module code)
 */
export function configure(appGroupId: string = 'group.com.tsouvili.wakey'): void {
  // FLAG_APP_GROUP_ID_MATCHING: Pass the App Group ID to the native module
  ExpoAlarmKit.configure(appGroupId);
}

export function requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'> {
  return ExpoAlarmKit.requestAuthorization();
}

export function scheduleAlarm(options: OneTimeAlarmOptions): Promise<boolean> {
  return ExpoAlarmKit.scheduleAlarm(options);
}

export function scheduleRepeatingAlarm(options: RepeatingAlarmOptions): Promise<boolean> {
  return ExpoAlarmKit.scheduleRepeatingAlarm(options);
}

export function cancelAlarm(id: string): Promise<boolean> {
  return ExpoAlarmKit.cancelAlarm(id);
}

export function getAllAlarms(): AlarmMetadata[] {
  return ExpoAlarmKit.getAllAlarms();
}

/**
 * Retrieve the launch payload (if any) that was recorded when the user dismissed or snoozed
 * the alarm from the lock screen. This will clear the payload on read.
 */
export function getLaunchPayload(): LaunchPayload | null {
  return ExpoAlarmKit.getLaunchPayload();
}

/**
 * Subscribe to launch payload events when the app is already active/running in the foreground.
 */
export function addLaunchPayloadListener(listener: (event: LaunchPayload) => void): Subscription {
  return eventEmitter.addListener('onLaunchPayloadReceived', listener);
}
