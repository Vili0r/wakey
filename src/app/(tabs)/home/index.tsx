import SFIcon from '@/components/SF-icon';
import AlarmCard from '@/components/alarm-card';
import GlassButton from '@/components/glass-button';
import HorizonArc from '@/components/horizon-arc';
import { THEMES } from '@/constants/theme';
import { db } from '@/db/db';
import { alarms as alarmsTable } from '@/db/schema';
import {
  alarmStore,
  Haptics,
  mapDbToUiAlarm,
  safeAlarmKit,
  safeSnoozeActivity,
  syncWithNativeState,
} from '@/utils/alarm-store';
import { countdownLabel, format12h, nextAlarm } from '@/utils/time';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const systemScheme = useColorScheme();
  const isDark = systemScheme !== 'light';
  const { data: dbAlarms = [] } = useLiveQuery(db.select().from(alarmsTable));

  const alarms = useMemo(() => {
    return dbAlarms.map(mapDbToUiAlarm);
  }, [dbAlarms]);

  const [now, setNow] = useState(() => new Date());
  const navigation = useNavigation();

  // Keep the countdown honest
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Sync Drizzle DB with native state
  const refreshAlarms = useCallback(() => {
    syncWithNativeState().catch((err) => {
      console.error('Error syncing with native state:', err);
    });
  }, []);

  // Sync alarms when screen is refocused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshAlarms();
    });
    return unsubscribe;
  }, [navigation, refreshAlarms]);

  // Handle launch payload from alarm dismiss/snooze
  const handleLaunchPayload = useCallback((payload: any) => {
    if (!payload) return;

    if (payload.payload === 'snooze') {
      if (payload.fireDate) {
        // End any existing snooze activities first
        safeSnoozeActivity.endAll();
        // Start new snooze countdown Live Activity
        const fireTimestamp = new Date(payload.fireDate).getTime();
        safeSnoozeActivity.start({
          fireDate: fireTimestamp,
          title: payload.title || 'Alarm',
        });
      }
    } else if (payload.payload === 'dismiss') {
      // End snooze countdown activity on alarm dismissal
      safeSnoozeActivity.endAll();
    }

    // Refresh alarm list from native state after any interaction
    refreshAlarms();
  }, [refreshAlarms]);

  // Configure and synchronize AlarmKit on mount
  useEffect(() => {
    safeAlarmKit.configure();
    safeAlarmKit.requestAuthorization().then(() => {
      refreshAlarms();

      // Read cold-launch payload (user tapped dismiss/snooze while app was closed)
      const coldPayload = safeAlarmKit.getLaunchPayload();
      if (coldPayload) {
        handleLaunchPayload(coldPayload);
      }
    });

    // Subscribe to events received while app is already running in foreground
    const subscription = safeAlarmKit.addLaunchPayloadListener((payload: any) => {
      handleLaunchPayload(payload);
    });

    return () => {
      subscription.remove();
    };
  }, [handleLaunchPayload, refreshAlarms]);

  const theme = isDark ? THEMES.dark : THEMES.light;

  // Animated background crossfade between themes
  const themeP = useSharedValue(isDark ? 0 : 1);
  useEffect(() => {
    themeP.value = withTiming(isDark ? 0 : 1, {
      duration: 480,
      easing: Easing.out(Easing.cubic),
    });
  }, [isDark, themeP]);

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeP.value,
      [0, 1],
      [THEMES.dark.bg, THEMES.light.bg],
    ),
  }));

  const next = useMemo(() => nextAlarm(alarms, now), [alarms, now]);

  // Sun progress: full arc = 12 hours out → ringing now
  const HORIZON_WINDOW = 12 * 60 * 60 * 1000;
  const progress = next
    ? Math.min(Math.max(1 - next.ms / HORIZON_WINDOW, 0.04), 0.97)
    : 0.04;

  const heroTime = next ? format12h(next.alarm.hour, next.alarm.minute) : null;

  const toggleAlarm = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    alarmStore.toggleAlarm(id);
  };
  function greeting(now: Date) {
    const h = now.getHours();
    if (h < 5) return 'Still up?';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  return (
    <>
      <Animated.View style={[styles.root, bgStyle]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { marginTop: insets.top - 50 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Custom inline header (without native translucent glass component) */}
          <View style={styles.customHeader}>
            <View>
              <Text style={[styles.greeting, { color: theme.textDim }]}>
                {greeting(now)}
              </Text>
              <Text style={[styles.brand, { color: theme.text }]}>Dawned</Text>
            </View>
            <Link href="/home/new-alarm" asChild>
              <GlassButton isDark={isDark} style={styles.headerRightBtnGlass}>
                <SFIcon name="alarm" size={22} color={theme.accent} />
              </GlassButton>
            </Link>
          </View>
          {/* Hero — next alarm */}
          <Animated.View
            entering={FadeInDown.delay(60).springify().damping(18)}
            style={styles.hero}
          >
            {next && heroTime ? (
              <>
                <Text style={[styles.eyebrow, { color: theme.textFaint }]}>
                  {countdownLabel(next.ms)}
                </Text>
                <View style={styles.heroTimeRow}>
                  <Text style={[styles.heroTime, { color: theme.text }]}>
                    {heroTime.time}
                  </Text>
                  <Text style={[styles.heroPeriod, { color: theme.accentDeep }]}>
                    {heroTime.period}
                  </Text>
                </View>
                <Text style={[styles.heroSub, { color: theme.textDim }]}>
                  {next.alarm.label} · {next.alarm.challenge.label.toLowerCase()} to
                  silence it
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.eyebrow, { color: theme.textFaint }]}>
                  NO ALARMS SET
                </Text>
                <View style={styles.heroTimeRow}>
                  <Text style={[styles.heroTime, { color: theme.textFaint }]}>
                    --:--
                  </Text>
                </View>
                <Text style={[styles.heroSub, { color: theme.textDim }]}>
                  The horizon is clear. Set one below.
                </Text>
              </>
            )}

            <HorizonArc width={width - 24} progress={progress} theme={theme} />

            {/* Horizon line */}
            <LinearGradient
              colors={['transparent', theme.horizon, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.horizonLine}
            />
          </Animated.View>

          {/* Alarm list */}
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listHeader, { color: theme.textFaint }]}>
              YOUR ALARMS
            </Text>
            <Text style={[styles.listHeader, { color: theme.textFaint }]}>
              {alarms.filter((a) => a.enabled).length} ON
            </Text>
          </View>

          {alarms.map((alarm, i) => (
            <AlarmCard
              key={alarm.id}
              alarm={alarm}
              theme={theme}
              index={i}
              onToggle={() => toggleAlarm(alarm.id)}
              onDelete={() => alarmStore.deleteAlarm(alarm.id)}
            />
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerRightBtnGlass: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  brand: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 26,
    letterSpacing: 0.3,
  },
  hero: { alignItems: 'center', marginBottom: 8 },
  eyebrow: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroTime: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 92,
    lineHeight: 98,
    letterSpacing: -2,
    paddingHorizontal: 16,
  },
  heroPeriod: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
    letterSpacing: 1.5,
    marginLeft: -4,
    marginBottom: 18,
  },
  heroSub: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13.5,
    marginTop: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  horizonLine: {
    height: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    marginTop: -12,
    marginBottom: 18,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  listHeader: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 2,
  },
});