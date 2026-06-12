import SFIcon from '@/components/SF-icon';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  useColorScheme
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { Theme, THEMES } from '@/constants/theme';
import { Alarm, alarmStore, Haptics, INITIAL_ALARMS, safeAlarmKit, safeSnoozeActivity, scheduleAlarmNative } from '@/utils/alarm-store';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

function format12h(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return { time: `${h}:${String(minute).padStart(2, '0')}`, period };
}

/** Milliseconds until the next firing of an alarm, respecting its days. */
function msUntil(alarm: Alarm, now: Date) {
  for (let d = 0; d < 8; d++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + d);
    candidate.setHours(alarm.hour, alarm.minute, 0, 0);
    const dayOk =
      alarm.days.length === 0 || alarm.days.includes(candidate.getDay());
    if (dayOk && candidate.getTime() > now.getTime()) {
      return candidate.getTime() - now.getTime();
    }
  }
  return Infinity;
}

function nextAlarm(alarms: Alarm[], now: Date) {
  let best: { alarm: Alarm; ms: number } | null = null;
  for (const a of alarms) {
    if (!a.enabled) continue;
    const ms = msUntil(a, now);
    if (!best || ms < best.ms) best = { alarm: a, ms };
  }
  return best;
}

function countdownLabel(ms: number) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `RINGS IN ${m} MIN`;
  return `RINGS IN ${h}H ${String(m).padStart(2, '0')}M`;
}


/* ------------------------------------------------------------------ */
/* Horizon Arc — the signature element                                 */
/* ------------------------------------------------------------------ */

function HorizonArc({
  width,
  progress,
  theme,
}: {
  width: number;
  progress: number; // 0 → just set, 1 → about to ring
  theme: Theme;
}) {
  const pad = 28;
  if (width <= pad * 2) return null;

  const rx = (width - pad * 2) / 2; // wide…
  const ry = 92; // …but shallow: a horizon, not a dome
  const baseY = ry + 22;
  const height = baseY + 14;
  const cx = width / 2;

  // Sun position along the arc (left horizon → right horizon)
  const angle = Math.PI * (1 - progress);
  const sx = cx + rx * Math.cos(angle);
  const sy = baseY - ry * Math.sin(angle);

  // Format to 1 decimal place to prevent long float parser issues in react-native-svg
  const rxF = parseFloat(rx.toFixed(1));
  const ryF = parseFloat(ry.toFixed(1));
  const baseYF = parseFloat(baseY.toFixed(1));
  const sxF = parseFloat(sx.toFixed(1));
  const syF = parseFloat(sy.toFixed(1));
  const endXF = parseFloat((width - pad).toFixed(1));

  const trackPath = `M ${pad} ${baseYF} A ${rxF} ${ryF} 0 0 1 ${endXF} ${baseYF}`;
  const litPath =
    progress > 0.005
      ? `M ${pad} ${baseYF} A ${rxF} ${ryF} 0 0 1 ${sxF} ${syF}`
      : '';

  // Breathing glow on the sun
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.45, 0.95]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.85, 1.12]) }],
  }));

  const GLOW = 84;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <RadialGradient id="sunCore" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={theme.accent} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.accentDeep} stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* Dotted track — the night still to cross */}
        <Path
          d={trackPath}
          stroke={theme.arcTrack}
          strokeWidth={1.6}
          strokeDasharray="1, 7"
          strokeLinecap="round"
          fill="none"
        />

        {/* Lit portion — how far the sun has come */}
        {litPath !== '' && (
          <Path
            d={litPath}
            stroke={theme.accent}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
        )}

        {/* Horizon endpoints */}
        <Circle cx={pad} cy={baseYF} r={2.5} fill={theme.arcTrack} />
        <Circle cx={endXF} cy={baseYF} r={2.5} fill={theme.accentDeep} />

        {/* Sun core */}
        <Circle cx={sxF} cy={syF} r={7} fill="url(#sunCore)" />
      </Svg>

      {/* Soft breathing halo — SVG radial gradient, so it glows on both platforms */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: sxF - GLOW / 2,
            top: syF - GLOW / 2,
            width: GLOW,
            height: GLOW,
          },
          glowStyle,
        ]}
      >
        <Svg width={GLOW} height={GLOW} viewBox={`0 0 ${GLOW} ${GLOW}`}>
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.accent} stopOpacity="0.55" />
              <Stop offset="55%" stopColor={theme.accentDeep} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={theme.accentDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#sunGlow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function PressScale({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  const pressed = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = withSpring(1, { damping: 20, stiffness: 300 }))}
      onPressOut={() => (pressed.value = withSpring(0, { damping: 20, stiffness: 300 }))}
    >
      <Animated.View style={[style, aStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

function GlassButton({
  children,
  style,
  isDark,
  ...props
}: {
  children: React.ReactNode;
  style?: object;
  isDark: boolean;
  [key: string]: any;
}) {
  const hasGlass = isLiquidGlassAvailable();
  if (hasGlass) {
    return (
      <GlassView isInteractive style={style}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          {...props}
        >
          {children}
        </TouchableOpacity>
      </GlassView>
    );
  }
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        style,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
        },
      ]}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}

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
    backgroundColor: interpolateColor(
      p.value,
      [0, 1],
      [theme.toggleOff, theme.accent],
    ),
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

function ThemeButton({
  isDark,
  onPress,
  theme,
}: {
  isDark: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const p = useSharedValue(isDark ? 0 : 1);
  useEffect(() => {
    p.value = withTiming(isDark ? 0 : 1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [isDark, p]);

  const moonStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ rotate: `${interpolate(p.value, [0, 1], [0, 90])}deg` }],
    position: 'absolute' as const,
  }));
  const sunStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ rotate: `${interpolate(p.value, [0, 1], [-90, 0])}deg` }],
    position: 'absolute' as const,
  }));

  return (
    <PressScale
      onPress={onPress}
      style={[
        styles.themeButton,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
      ]}
    >
      <Animated.View style={moonStyle}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            fill="none"
            stroke={theme.text}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={sunStyle}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={4} fill="none" stroke={theme.text} strokeWidth={1.8} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Path
                key={deg}
                d={`M ${12 + 6.5 * Math.cos(rad)} ${12 + 6.5 * Math.sin(rad)} L ${
                  12 + 8.5 * Math.cos(rad)
                } ${12 + 8.5 * Math.sin(rad)}`}
                stroke={theme.text}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Animated.View>
    </PressScale>
  );
}

/* ------------------------------------------------------------------ */
/* Alarm card                                                          */
/* ------------------------------------------------------------------ */

function AlarmCard({
  alarm,
  theme,
  index,
  onToggle,
}: {
  alarm: Alarm;
  theme: Theme;
  index: number;
  onToggle: () => void;
}) {
  const { time, period } = format12h(alarm.hour, alarm.minute);
  const dim = !alarm.enabled;

  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 90)
        .springify()
        .damping(18)}
    >
      <PressScale
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={[
                styles.cardTime,
                { color: dim ? theme.textFaint : theme.text },
              ]}
            >
              {time}
            </Text>
            <Text
              style={[
                styles.cardPeriod,
                { color: dim ? theme.textFaint : theme.textDim },
              ]}
            >
              {' '}
              {period}
            </Text>
          </View>
          <Toggle value={alarm.enabled} onChange={onToggle} theme={theme} />
        </View>

        <Text
          style={[styles.cardLabel, { color: dim ? theme.textFaint : theme.textDim }]}
          numberOfLines={1}
        >
          {alarm.label}
        </Text>

        <View style={styles.cardBottom}>
          {/* Challenge chip — what it costs to silence this one */}
          <View
            style={[
              styles.chip,
              { backgroundColor: dim ? 'transparent' : theme.chipBg },
              dim && { borderWidth: 1, borderColor: theme.surfaceBorder },
            ]}
          >
            <Text
              style={[
                styles.chipGlyph,
                { color: dim ? theme.textFaint : theme.chipText },
              ]}
            >
              {alarm.challenge.glyph}
            </Text>
            <Text
              style={[
                styles.chipText,
                { color: dim ? theme.textFaint : theme.chipText },
              ]}
            >
              {alarm.challenge.label}
            </Text>
          </View>

          <View style={styles.daysRow}>
            {DAY_LETTERS.map((letter, i) => {
              const active = alarm.days.includes(i);
              return (
                <Text
                  key={`${letter}-${i}`}
                  style={[
                    styles.dayLetter,
                    {
                      color:
                        active && !dim ? theme.accentDeep : theme.textFaint,
                      fontFamily:
                        active && !dim ? 'Sora_600SemiBold' : 'Sora_400Regular',
                    },
                  ]}
                >
                  {letter}
                </Text>
              );
            })}
          </View>
        </View>
      </PressScale>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Home screen                                                         */
/* ------------------------------------------------------------------ */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const systemScheme = useColorScheme();
  const isDark = systemScheme !== 'light';
  const [alarms, setAlarms] = useState(() => alarmStore.getAlarms());
  const [now, setNow] = useState(() => new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigation = useNavigation();

  // Keep the countdown honest
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Refresh alarms from native state
  const refreshAlarms = useCallback(() => {
    setAlarms([...alarmStore.getAlarms()]);
  }, []);

  // Sync alarms when screen is refocused or when store changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshAlarms();
    });
    return unsubscribe;
  }, [navigation, refreshAlarms]);

  useEffect(() => {
    return alarmStore.subscribe(() => {
      refreshAlarms();
    });
  }, [refreshAlarms]);

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
      const native = safeAlarmKit.getAllAlarms();
      if (native.length > 0) {
        setAlarms([...alarmStore.getAlarms()]);
      } else {
        // Schedule initial enabled alarms in AlarmKit so they actually fire
        for (const alarm of INITIAL_ALARMS) {
          if (alarm.enabled) {
            scheduleAlarmNative(alarm);
          }
        }
        safeAlarmKit.updateWidgetSnapshot(INITIAL_ALARMS);
        setAlarms([...INITIAL_ALARMS]);
      }

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
  }, [handleLaunchPayload]);

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
          contentContainerStyle={[styles.scroll, { marginTop: insets.top - 50}]}
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
            />
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
  },
  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerRightBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  themeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero */
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

  /* List */
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

  /* Card */
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTime: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 34,
    letterSpacing: -0.5,
    paddingHorizontal: 8,
  },
  cardPeriod: {
    fontFamily: 'Sora_500Medium',
    fontSize: 12,
    letterSpacing: 1,
  },
  cardLabel: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
    gap: 6,
  },
  chipGlyph: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
  },
  chipText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  daysRow: { flexDirection: 'row', gap: 7 },
  dayLetter: { fontSize: 11 },

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
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  /* FAB */
  fabWrap: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 26,
    gap: 8,
    shadowColor: '#FF6E50',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPlus: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 18,
    marginTop: -1,
  },
  fabText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14.5,
    letterSpacing: 0.3,
  },
});