import SFIcon from '@/components/SF-icon';
import { db } from '@/db/db';
import { alarms as alarmsTable, alarmEvents, streakDays, streakState, settings as settingsTable } from '@/db/schema';
import { dbIdToUUID, safeAlarmKit } from '@/utils/alarm-store';
import { router } from 'expo-router';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { useCameraPermission } from 'react-native-vision-camera';
import { useColorScheme } from 'react-native';

/* ------------------------------------------------------------------ */
/* Theme — identical tokens to the other screens                       */
/* ------------------------------------------------------------------ */
const THEMES = {
  dark: {
    bg: '#0D0F1E',
    surface: '#171A2E',
    surfaceBorder: 'rgba(235, 238, 255, 0.07)',
    text: '#EEF0FF',
    textDim: 'rgba(238, 240, 255, 0.56)',
    textFaint: 'rgba(238, 240, 255, 0.32)',
    accent: '#FFB45C',
    accentDeep: '#FF6E50',
    chipBg: 'rgba(255, 180, 92, 0.13)',
    chipText: '#FFC787',
    toggleOff: 'rgba(238, 240, 255, 0.14)',
    fabText: '#1A1206',
    danger: '#FF6E6E',
  },
  light: {
    bg: '#F1F4FA',
    surface: '#FFFFFF',
    surfaceBorder: 'rgba(24, 28, 46, 0.06)',
    text: '#181C2E',
    textDim: 'rgba(24, 28, 46, 0.58)',
    textFaint: 'rgba(24, 28, 46, 0.34)',
    accent: '#F59A3E',
    accentDeep: '#F25C3C',
    chipBg: 'rgba(242, 92, 60, 0.09)',
    chipText: '#D9622E',
    toggleOff: 'rgba(24, 28, 46, 0.14)',
    fabText: '#FFFFFF',
    danger: '#E2483F',
  },
};

type Theme = typeof THEMES.dark;

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */
function Toggle({
  value,
  onChange,
  theme,
}: {
  value: boolean;
  onChange: () => void;
  theme: Theme;
}) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [value, p]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [theme.toggleOff, theme.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(p.value, [0, 1], [2, 20]) }],
  }));

  return (
    <Pressable
      onPress={onChange}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  theme,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  theme: Theme;
  danger?: boolean;
}) {
  const content = (
    <View style={styles.row}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: theme.bg, borderColor: theme.surfaceBorder },
        ]}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.rowTitle,
            { color: danger ? theme.danger : theme.text },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: theme.textFaint }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: theme.surfaceBorder }}
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

function Divider({ theme }: { theme: Theme }) {
  return <View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />;
}

function Chevron({ theme }: { theme: Theme }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="m9 6 6 6-6 6"
        stroke={theme.textFaint}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Group({
  label,
  delay,
  theme,
  children,
}: {
  label: string;
  delay: number;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)}>
      <Text style={[styles.groupLabel, { color: theme.textFaint }]}>{label}</Text>
      <View
        style={[
          styles.group,
          { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy Screen Component                                            */
/* ------------------------------------------------------------------ */
export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const { hasPermission, requestPermission } = useCameraPermission();
  const [notifPermission, setNotifPermission] = useState<string>('undetermined');

  // Load telemetry preferences from Drizzle settings
  const { data: settingsRows = [] } = useLiveQuery(
    db.select().from(settingsTable).where(eq(settingsTable.id, 1))
  );
  const currentSettings = settingsRows[0];

  const onboardingAnswers = (currentSettings?.onboardingAnswers ?? {}) as Record<string, unknown>;
  const shareAnalytics = onboardingAnswers.shareAnalytics !== false; // default true
  const crashReports = onboardingAnswers.crashReports !== false; // default true

  const toggleAnalytics = async () => {
    try {
      const updatedAnswers = {
        ...onboardingAnswers,
        shareAnalytics: !shareAnalytics,
      };
      await db
        .update(settingsTable)
        .set({ onboardingAnswers: updatedAnswers, updatedAt: new Date() })
        .where(eq(settingsTable.id, 1));
    } catch (err) {
      console.error('Failed to toggle analytics preference:', err);
    }
  };

  const toggleCrashReports = async () => {
    try {
      const updatedAnswers = {
        ...onboardingAnswers,
        crashReports: !crashReports,
      };
      await db
        .update(settingsTable)
        .set({ onboardingAnswers: updatedAnswers, updatedAt: new Date() })
        .where(eq(settingsTable.id, 1));
    } catch (err) {
      console.error('Failed to toggle crash reporting preference:', err);
    }
  };

  const checkNotifPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotifPermission(status);
    } catch (err) {
      console.error('Failed to check notification permission:', err);
    }
  };

  useEffect(() => {
    checkNotifPermission();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkNotifPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleNotifPress = async () => {
    if (notifPermission === 'granted') {
      Alert.alert('Notifications Enabled', 'Wakey has permissions to show notification alerts and alarms.');
      return;
    }

    if (notifPermission === 'denied') {
      Alert.alert(
        'Enable Notifications',
        'Notification access is disabled. Please enable it in system settings to receive your alarm alerts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    } else {
      const res = await Notifications.requestPermissionsAsync();
      setNotifPermission(res.status);
    }
  };

  const handleCameraPress = async () => {
    if (hasPermission) {
      Alert.alert('Camera Enabled', 'Wakey has permissions to use the camera for photo-based alarm challenges.');
      return;
    }

    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Enable Camera Access',
        'Camera access is required for sky photo and item challenges. Please enable it in system settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleExportBackup = async () => {
    try {
      const allAlarms = await db.select().from(alarmsTable);
      const allEvents = await db.select().from(alarmEvents);
      const allStreakDays = await db.select().from(streakDays);
      const [currentStreakState] = await db.select().from(streakState);
      const [currentSettingsRow] = await db.select().from(settingsTable);

      const backupData = {
        app: 'wakey',
        exportedAt: new Date().toISOString(),
        alarms: allAlarms,
        alarmEvents: allEvents,
        streakDays: allStreakDays,
        streakState: currentStreakState,
        settings: currentSettingsRow,
      };

      await Share.share({
        message: JSON.stringify(backupData, null, 2),
        title: 'Wakey Data Backup',
      });
    } catch (err) {
      console.error('Failed to export backup data:', err);
      Alert.alert('Backup Failed', 'An error occurred while compiling your data.');
    }
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All App Data?',
      'This will delete all configuration settings, active alarms, streak history, and achievements permanently. You will be sent back to onboarding. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Everything', style: 'destructive', onPress: performReset },
      ]
    );
  };

  const performReset = async () => {
    try {
      // 1. Cancel all scheduled OS alarms natively
      const allAlarms = await db.select().from(alarmsTable);
      for (const alarm of allAlarms) {
        try {
          await safeAlarmKit.cancelAlarm(dbIdToUUID(alarm.id));
        } catch (err) {
          console.warn(`Failed to native cancel alarm id ${alarm.id}:`, err);
        }
      }

      // 2. Clear database tables
      await db.delete(alarmEvents);
      await db.delete(alarmsTable);
      await db.delete(streakDays);

      // 3. Reset stats singleton cache
      await db
        .update(streakState)
        .set({
          currentStreak: 0,
          longestStreak: 0,
          totalBeaten: 0,
          lastBeatenDay: null,
          freezesRemaining: 0,
          updatedAt: new Date(),
        })
        .where(eq(streakState.id, 1));

      // 4. Reset preferences singleton cache
      await db
        .update(settingsTable)
        .set({
          name: '',
          soundEnabled: true,
          defaultSoundId: 'sunrise',
          hapticsEnabled: true,
          autoSilenceSeconds: 0,
          defaultChallenge: 'math',
          defaultDifficulty: 'standard',
          volume: 1.0,
          onboardingComplete: false,
          wakeHour: null,
          wakeMinute: null,
          onboardingAnswers: {},
          updatedAt: new Date(),
        })
        .where(eq(settingsTable.id, 1));

      Alert.alert(
        'Data Cleared',
        'Your local database has been successfully reset. Tap OK to start setup again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Direct back to root welcome/onboarding index
              router.replace('/');
            },
          },
        ]
      );
    } catch (err) {
      console.error('Wipe data failed:', err);
      Alert.alert('Reset Failed', 'An error occurred while wiping database rows.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Core Local Privacy Highlights */}
        <Animated.View
          entering={FadeInDown.delay(50).springify().damping(18)}
          style={[
            styles.calloutCard,
            { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
          ]}
        >
          <View style={styles.calloutHeader}>
            <View style={[styles.calloutIconContainer, { backgroundColor: theme.chipBg }]}>
              <SFIcon name="shield.fill" size={24} color={theme.accent} />
            </View>
            <Text style={[styles.calloutTitle, { color: theme.text }]}>
              100% Local Storage
            </Text>
          </View>
          <Text style={[styles.calloutBody, { color: theme.textDim }]}>
            Wakey stores all alarms, achievements, wake-up streaks, and challenges locally on your device. We do not require account registration, and your data never leaves your phone.
          </Text>
        </Animated.View>

        {/* System Permissions Checks */}
        <Group label="DEVICE PERMISSIONS" delay={110} theme={theme}>
          <Row
            icon={<SFIcon name="bell.fill" size={18} color={theme.accent} />}
            title="Notifications"
            subtitle={
              notifPermission === 'granted'
                ? 'Allowed · Alarms will alert you'
                : notifPermission === 'denied'
                ? 'Denied · Click to enable in Settings'
                : 'Configure notification permission'
            }
            right={
              notifPermission === 'granted' ? (
                <SFIcon name="checkmark.circle.fill" size={20} color={theme.accent} />
              ) : (
                <Chevron theme={theme} />
              )
            }
            onPress={handleNotifPress}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={<SFIcon name="camera.fill" size={18} color={theme.accent} />}
            title="Camera"
            subtitle={
              hasPermission
                ? 'Allowed · Camera challenges active'
                : 'Denied · Required for photo challenges'
            }
            right={
              hasPermission ? (
                <SFIcon name="checkmark.circle.fill" size={20} color={theme.accent} />
              ) : (
                <Chevron theme={theme} />
              )
            }
            onPress={handleCameraPress}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={<SFIcon name="waveform.path" size={18} color={theme.accent} />}
            title="Motion & Sensors"
            subtitle="Enabled · Physical sensor counters run fully on-device"
            right={<SFIcon name="checkmark.circle.fill" size={20} color={theme.accent} />}
            theme={theme}
          />
        </Group>

        {/* Local Settings Toggle Options */}
        <Group label="DATA PREFERENCES" delay={170} theme={theme}>
          <Row
            icon={<SFIcon name="chart.bar.fill" size={18} color={theme.accent} />}
            title="Anonymous Analytics"
            subtitle="Share general usage events to help improve the app"
            right={
              <Toggle value={shareAnalytics} onChange={toggleAnalytics} theme={theme} />
            }
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={<SFIcon name="exclamationmark.triangle.fill" size={18} color={theme.accent} />}
            title="Crash Reporting"
            subtitle="Send crash logs when something goes wrong"
            right={
              <Toggle value={crashReports} onChange={toggleCrashReports} theme={theme} />
            }
            theme={theme}
          />
        </Group>

        {/* Destructive / Export Settings */}
        <Group label="DATA MANAGEMENT" delay={230} theme={theme}>
          <Row
            icon={<SFIcon name="square.and.arrow.up" size={18} color={theme.accent} />}
            title="Export Backup"
            subtitle="Download local configuration and statistics as JSON"
            right={<Chevron theme={theme} />}
            onPress={handleExportBackup}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={<SFIcon name="trash.fill" size={18} color={theme.danger} />}
            title="Reset All Data"
            subtitle="Delete all data logs and start onboarding fresh"
            right={<Chevron theme={theme} />}
            onPress={handleResetData}
            theme={theme}
            danger={true}
          />
        </Group>

        <Text style={[styles.footer, { color: theme.textFaint }]}>
          Wakey Privacy · Version 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  /* Callout Card */
  calloutCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 8,
    gap: 12,
    borderCurve: 'continuous',
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calloutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  calloutTitle: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
    flex: 1,
  },
  calloutBody: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },

  /* Group */
  groupLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  group: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  rowTitle: {
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
  },
  rowSub: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },

  /* Toggle */
  toggleTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  footer: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 28,
  },
});
