import { Subscription } from 'expo';

export default {
  configure(appGroupId: string) {
    console.warn('ExpoAlarmKit configure is not supported on web.');
  },
  async requestAuthorization() {
    return 'notDetermined';
  },
  async scheduleAlarm() {
    return false;
  },
  async scheduleRepeatingAlarm() {
    return false;
  },
  async cancelAlarm() {
    return false;
  },
  getAllAlarms() {
    return [];
  },
  getLaunchPayload() {
    return null;
  },
  addListener(eventName: string, listener: any): Subscription {
    return {
      remove: () => {}
    };
  },
  removeListeners(count: number) {}
};
