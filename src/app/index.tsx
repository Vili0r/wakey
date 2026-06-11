import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { Colors, Spacing, BottomTabInset } from '../constants/theme';
import * as AlarmKit from '../../modules/expo-alarm-kit';
import { nextAlarmWidget, snoozeCountdownActivity } from '../../widgets';

// FLAG_APP_GROUP_ID_MATCHING: App Group ID is defined here to configure the local module.
const APP_GROUP_ID = 'group.com.tsouvili.wakey';

// Quick dependency-free UUID generator for compile safety and compatibility
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper to compute next occurrence of a repeating alarm (weekly)
const getNextOccurrence = (hour: number, minute: number, weekdays: number[]): Date => {
  const now = new Date();
  let next = new Date();
  next.setHours(hour, minute, 0, 0);
  
  let minDiff = Infinity;
  let bestDate = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000); // default next week
  
  for (const day of weekdays) {
    const currentDay = now.getDay();
    let diff = day - currentDay;
    if (diff < 0 || (diff === 0 && now.getTime() >= next.getTime())) {
      diff += 7;
    }
    
    const targetDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
    targetDate.setHours(hour, minute, 0, 0);
    
    const targetDiff = targetDate.getTime() - now.getTime();
    if (targetDiff < minDiff) {
      minDiff = targetDiff;
      bestDate = targetDate;
    }
  }
  
  return bestDate;
};

// Main function to calculate next alarm and update iOS home/lock screen widget
const updateWidgetSnapshot = (activeAlarms: AlarmKit.AlarmMetadata[]) => {
  try {
    if (activeAlarms.length === 0) {
      nextAlarmWidget.updateSnapshot({ title: '', timeString: '', hasAlarm: false });
      return;
    }

    let nextAlarm: AlarmKit.AlarmMetadata | null = null;
    let nextAlarmDate: Date | null = null;

    for (const alarm of activeAlarms) {
      let alarmDate: Date;
      if (alarm.type === 'one-time') {
        alarmDate = new Date(alarm.date!);
      } else {
        alarmDate = getNextOccurrence(alarm.hour!, alarm.minute!, alarm.weekdays!);
      }

      // Skip past alarms (just in case)
      if (alarmDate.getTime() <= Date.now()) {
        continue;
      }

      if (!nextAlarmDate || alarmDate.getTime() < nextAlarmDate.getTime()) {
        nextAlarmDate = alarmDate;
        nextAlarm = alarm;
      }
    }

    if (nextAlarm && nextAlarmDate) {
      const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
      const formattedTime = nextAlarmDate.toLocaleTimeString('en-US', options);
      
      nextAlarmWidget.updateSnapshot({
        title: nextAlarm.title,
        timeString: formattedTime,
        hasAlarm: true
      });
    } else {
      nextAlarmWidget.updateSnapshot({ title: '', timeString: '', hasAlarm: false });
    }
  } catch (err) {
    console.error('Failed to update widget snapshot:', err);
  }
};

export default function HomeScreen() {
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'unspecified' || !scheme ? 'dark' : scheme];

  const [authStatus, setAuthStatus] = useState<string>('checking...');
  const [alarms, setAlarms] = useState<AlarmKit.AlarmMetadata[]>([]);
  const [launchPayload, setLaunchPayload] = useState<AlarmKit.LaunchPayload | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  const handleLaunchPayload = (payload: AlarmKit.LaunchPayload) => {
    if (payload.payload === 'snooze') {
      if (payload.fireDate) {
        // 1. End any existing activities first
        try {
          const activeInstances = snoozeCountdownActivity.getInstances();
          addLog(`Ending ${activeInstances.length} active snooze activities`);
          for (const inst of activeInstances) {
            inst.end('immediate');
          }
        } catch (err: any) {
          addLog(`Error ending activities: ${err.message}`);
        }

        // 2. Start the new countdown activity
        const fireTimestamp = new Date(payload.fireDate).getTime();
        addLog(`Starting snooze Live Activity for fire date: ${payload.fireDate}`);
        try {
          snoozeCountdownActivity.start({
            fireDate: fireTimestamp,
            title: payload.title || 'Alarm'
          });
          addLog(`Successfully started snooze Live Activity`);
        } catch (err: any) {
          addLog(`Error starting Live Activity: ${err.message}`);
        }
      }
    } else if (payload.payload === 'dismiss') {
      // End snooze countdown activity on alarm dismissal
      try {
        const activeInstances = snoozeCountdownActivity.getInstances();
        addLog(`Ending ${activeInstances.length} active snooze activities on dismiss`);
        for (const inst of activeInstances) {
          inst.end('immediate');
        }
      } catch (err: any) {
        addLog(`Error ending activities: ${err.message}`);
      }
    }
  };

  const refreshAlarms = () => {
    try {
      const activeAlarms = AlarmKit.getAllAlarms();
      setAlarms(activeAlarms);
      addLog(`Refreshed alarms list (found ${activeAlarms.length} persisted)`);
      
      // Update iOS widget snapshot
      updateWidgetSnapshot(activeAlarms);

      // End active snooze activities if list is empty
      if (activeAlarms.length === 0) {
        try {
          const activeInstances = snoozeCountdownActivity.getInstances();
          if (activeInstances.length > 0) {
            addLog(`Ending ${activeInstances.length} active snooze activities (alarms list empty)`);
            for (const inst of activeInstances) {
              inst.end('immediate');
            }
          }
        } catch (err: any) {
          addLog(`Error ending activities: ${err.message}`);
        }
      }
    } catch (err: any) {
      addLog(`Error fetching alarms: ${err.message}`);
    }
  };

  useEffect(() => {
    // 1. Configure local native module with the shared App Group ID
    // FLAG_APP_GROUP_ID_MATCHING: App Group ID passed to configure()
    addLog(`Configuring module with App Group: ${APP_GROUP_ID}`);
    AlarmKit.configure(APP_GROUP_ID);

    // 2. Request authorization on mount
    AlarmKit.requestAuthorization()
      .then((status) => {
        setAuthStatus(status);
        addLog(`Authorization status: ${status}`);
      })
      .catch((err) => {
        setAuthStatus('error');
        addLog(`Authorization error: ${err.message}`);
      });

    // 3. Read cold-launch payload
    try {
      const payload = AlarmKit.getLaunchPayload();
      if (payload) {
        setLaunchPayload(payload);
        addLog(`Stashed cold-launch payload found: ${JSON.stringify(payload)}`);
        handleLaunchPayload(payload);
      } else {
        addLog('No cold-launch payload found.');
      }
    } catch (err: any) {
      addLog(`Error reading launch payload: ${err.message}`);
    }

    // 4. Subscribe to events received while app is already running
    const subscription = AlarmKit.addLaunchPayloadListener((payload) => {
      setLaunchPayload(payload);
      addLog(`🔔 Active App Event Received: ${JSON.stringify(payload)}`);
      handleLaunchPayload(payload);
    });

    // 5. Initial fetch of persisted alarms
    refreshAlarms();

    return () => {
      subscription.remove();
    };
  }, []);

  const scheduleOneTimeAlarm = async () => {
    try {
      const id = generateUUID();
      // Date set exactly 60 seconds from now
      const date = new Date(Date.now() + 60000).toISOString();
      const title = 'One-time Test Alarm';

      addLog(`Scheduling one-time alarm for +60s (ID: ${id.substring(0, 8)}...)`);

      const success = await AlarmKit.scheduleAlarm({
        id,
        date,
        title,
        launchAppOnDismiss: true,
        launchAppOnSnooze: false,
        doSnoozeIntent: true,
        snoozeDuration: 15, // Snooze for 15s out
      });

      if (success) {
        addLog('Successfully scheduled one-time alarm.');
        refreshAlarms();
      } else {
        addLog('Failed to schedule one-time alarm.');
      }
    } catch (err: any) {
      addLog(`Schedule failed: ${err.message}`);
    }
  };

  const scheduleRepeatingAlarm = async () => {
    try {
      const id = generateUUID();
      const hour = 8;
      const minute = 30;
      const weekdays = [1, 2, 3, 4, 5]; // Mon - Fri
      const title = 'Repeating Weekday Alarm';

      addLog(`Scheduling repeating alarm 8:30 AM (ID: ${id.substring(0, 8)}...)`);

      const success = await AlarmKit.scheduleRepeatingAlarm({
        id,
        hour,
        minute,
        weekdays,
        title,
        launchAppOnDismiss: true,
        launchAppOnSnooze: false,
        doSnoozeIntent: true,
        snoozeDuration: 15,
      });

      if (success) {
        addLog('Successfully scheduled repeating alarm.');
        refreshAlarms();
      } else {
        addLog('Failed to schedule repeating alarm.');
      }
    } catch (err: any) {
      addLog(`Repeating schedule failed: ${err.message}`);
    }
  };

  const cancelAlarm = async (id: string) => {
    try {
      addLog(`Cancelling alarm ID: ${id.substring(0, 8)}...`);
      const success = await AlarmKit.cancelAlarm(id);
      if (success) {
        addLog('Successfully cancelled alarm.');
        
        // Also cancel any active snooze countdown Live Activities
        try {
          const activeInstances = snoozeCountdownActivity.getInstances();
          addLog(`Ending ${activeInstances.length} active snooze activities due to cancel`);
          for (const inst of activeInstances) {
            inst.end('immediate');
          }
        } catch (err: any) {
          addLog(`Error ending activities on cancel: ${err.message}`);
        }
        
        refreshAlarms();
      } else {
        addLog('Failed to cancel alarm.');
      }
    } catch (err: any) {
      addLog(`Cancel failed: ${err.message}`);
    }
  };

  const clearLaunchPayload = () => {
    setLaunchPayload(null);
    addLog('Cleared launch payload status from screen.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Block */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>AlarmKit Testbed</Text>
          <View style={[styles.badge, { backgroundColor: authStatus === 'authorized' ? '#10B981' : '#F59E0B' }]}>
            <Text style={styles.badgeText}>Auth: {authStatus}</Text>
          </View>
        </View>

        {/* Launch Payload Card */}
        <View style={[styles.card, { backgroundColor: themeColors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>LATEST LAUNCH ACTION</Text>
          {launchPayload ? (
            <View style={styles.payloadBox}>
              <Text style={styles.payloadText}>Alarm ID: {launchPayload.alarmId}</Text>
              <Text style={styles.payloadAction}>Action Type: {launchPayload.payload}</Text>
              <TouchableOpacity style={styles.clearBtn} onPress={clearLaunchPayload}>
                <Text style={styles.clearBtnText}>Dismiss Payload</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No active or cold-launch interaction recorded.</Text>
          )}
        </View>

        {/* Quick Actions Card */}
        <View style={[styles.card, { backgroundColor: themeColors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>CONTROLS</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={scheduleOneTimeAlarm}>
              <Text style={styles.actionBtnText}>⏰ One-time (60s out)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={scheduleRepeatingAlarm}>
              <Text style={styles.actionBtnText}>🔄 Repeating (Mon-Fri)</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.actionBtn, styles.refreshBtn]} onPress={refreshAlarms}>
            <Text style={styles.actionBtnText}>🔄 Refresh List</Text>
          </TouchableOpacity>
        </View>

        {/* Scheduled Alarms Card */}
        <View style={[styles.card, { backgroundColor: themeColors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>PERSISTED ALARMS ({alarms.length})</Text>
          {alarms.length > 0 ? (
            alarms.map((alarm) => (
              <View key={alarm.id} style={styles.alarmRow}>
                <View style={styles.alarmInfo}>
                  <Text style={[styles.alarmTitleText, { color: themeColors.text }]}>{alarm.title}</Text>
                  <Text style={[styles.alarmSubtitleText, { color: themeColors.textSecondary }]}>
                    {alarm.type === 'one-time'
                      ? `One-time: ${new Date(alarm.date!).toLocaleTimeString()}`
                      : `Repeating: ${alarm.hour}:${alarm.minute < 10 ? '0' + alarm.minute : alarm.minute} (days: ${alarm.weekdays?.join(', ')})`}
                  </Text>
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelAlarm(alarm.id)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No alarms scheduled in UserDefaults.</Text>
          )}
        </View>

        {/* Operation Logs */}
        <View style={[styles.card, { backgroundColor: themeColors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>LIVE LOGS</Text>
          <ScrollView style={styles.logContainer} nestedScrollEnabled>
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <Text key={index} style={styles.logText}>{log}</Text>
              ))
            ) : (
              <Text style={styles.logText}>Logs will appear here...</Text>
            )}
          </ScrollView>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: Spacing.one,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    backgroundColor: '#4b5563',
    marginTop: Spacing.one,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alarmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  alarmInfo: {
    flex: 1,
    marginRight: Spacing.two,
  },
  alarmTitleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  alarmSubtitleText: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  payloadBox: {
    padding: Spacing.two,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  payloadText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  payloadAction: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  clearBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 6,
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
  },
  clearBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logContainer: {
    maxHeight: 120,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: Spacing.two,
  },
  logText: {
    color: '#a3a3a3',
    fontFamily: Platform.select({ ios: 'CourierNewPSMT', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 4,
  },
});
