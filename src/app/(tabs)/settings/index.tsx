/* eslint-disable react-hooks/immutability */
import SFIcon from '@/components/SF-icon';
import SoundPicker from '@/components/sound-picker';
import { getAlarmSound } from '@/utils/alarm-sounds';
import { getDefaultSoundId, setDefaultSoundId } from '@/utils/settings-store';
import {
  InstrumentSerif_400Regular_Italic,
  useFonts,
} from '@expo-google-fonts/instrument-serif';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
} from '@expo-google-fonts/sora';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import React, { useEffect, useState } from 'react';
import { db } from '@/db/db';
import { streakState } from '@/db/schema';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { clearAllDatabaseData, seedDemoInsightsData } from '@/utils/alarm-store';
import { eq } from 'drizzle-orm';
import {
  Appearance,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from 'react-native-svg';
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
/* Shared building blocks (PressScale + your ThemeButton)              */
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

/* —— Your component, unchanged —— */
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
/* Toggle                                                              */
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

/* ------------------------------------------------------------------ */
/* Theme-mode segment (Light / Dark / System)                          */
/* ------------------------------------------------------------------ */

type ThemeMode = 'light' | 'dark' | 'system';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];
const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

function ModeSegment({
  mode,
  onChange,
  theme,
  width,
}: {
  mode: ThemeMode;
  onChange: (m: ThemeMode) => void;
  theme: Theme;
  width: number;
}) {
  const segW = (width - 8) / MODES.length;
  const idx = MODES.indexOf(mode);
  const p = useSharedValue(idx);
  useEffect(() => {
    p.value = withSpring(idx, { damping: 18, stiffness: 220 });
  }, [idx, p]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * segW }],
  }));

  return (
    <View
      style={[
        styles.segTrack,
        { width, backgroundColor: theme.bg, borderColor: theme.surfaceBorder },
      ]}
    >
      <Animated.View
        style={[
          styles.segThumb,
          { width: segW, backgroundColor: theme.chipBg, borderColor: theme.accent },
          thumbStyle,
        ]}
      />
      {MODES.map((m) => (
        <Pressable
          key={m}
          style={[styles.segOption, { width: segW }]}
          onPress={() => onChange(m)}
        >
          <Text
            style={[
              styles.segLabel,
              {
                color: m === mode ? theme.chipText : theme.textFaint,
                fontFamily: m === mode ? 'Sora_600SemiBold' : 'Sora_500Medium',
              },
            ]}
          >
            {MODE_LABELS[m]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Setting rows                                                        */
/* ------------------------------------------------------------------ */

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
          <Text style={[styles.rowSub, { color: theme.textFaint }]} numberOfLines={1}>
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

/* —— global theme state —— */
let globalThemeMode: ThemeMode = 'system';

/* —— tiny stroke icons, using SFIcon and SF Symbols matching the original visual style —— */
const Icon = {
  bell: (c: string) => <SFIcon name="bell" size={18} color={c} />,
  wave: (c: string) => <SFIcon name="waveform" size={18} color={c} />,
  vibrate: (c: string) => <SFIcon name="iphone.radiowaves.left.and.right" size={18} color={c} />,
  moonZ: (c: string) => <SFIcon name="moon.zzz" size={18} color={c} />,
  target: (c: string) => <SFIcon name="target" size={18} color={c} />,
  flame: (c: string) => <SFIcon name="flame" size={18} color={c} />,
  shield: (c: string) => <SFIcon name="shield" size={18} color={c} />,
  star: (c: string) => <SFIcon name="star" size={18} color={c} />,
  info: (c: string) => <SFIcon name="info.circle" size={18} color={c} />,
  logout: (c: string) => <SFIcon name="rectangle.portrait.and.arrow.right" size={18} color={c} />,
  hammer: (c: string) => <SFIcon name="hammer" size={18} color={c} />,
  trash: (c: string) => <SFIcon name="trash" size={18} color={c} />,
};

/* ------------------------------------------------------------------ */
/* Group container                                                     */
/* ------------------------------------------------------------------ */

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
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function SettingsScreen({
  isDark: propIsDark,
  onToggleTheme,
  onClose,
}: {
  isDark?: boolean;
  onToggleTheme?: () => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const systemScheme = useColorScheme();
  const isDark = propIsDark ?? (systemScheme === 'dark');
  const theme = isDark ? THEMES.dark : THEMES.light;

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular_Italic,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    SpaceMono_400Regular,
  });

  const [mode, setMode] = useState<ThemeMode>(globalThemeMode);
  const [haptics, setHaptics] = useState(true);
  const [autoSilence, setAutoSilence] = useState(false);
  const [defaultSound, setDefaultSound] = useState<string | null>(null);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);

  const { data: streakRows = [] } = useLiveQuery(db.select().from(streakState).where(eq(streakState.id, 1)));
  const streak = streakRows[0] || { currentStreak: 0, totalBeaten: 0 };

  useEffect(() => {
    let cancelled = false;
    getDefaultSoundId().then((id) => {
      if (!cancelled) setDefaultSound(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectSound = (id: string) => {
    setDefaultSound(id);
    setDefaultSoundId(id);
  };

  if (!fontsLoaded) return null;

  // Keep the segment, the row, and the parent in sync
  const setModeAndTheme = (m: ThemeMode) => {
    setMode(m);
    globalThemeMode = m;
    if (m === 'dark') {
      Appearance.setColorScheme('dark');
    } else if (m === 'light') {
      Appearance.setColorScheme('light');
    } else {
      Appearance.setColorScheme(undefined as any); // system default
    }
  };

  const toggleFromButton = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setModeAndTheme(nextMode);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      <Animated.ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 46, paddingBottom: insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
          <View
            style={[
              styles.profile,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.chipBg }]}>
              <Text style={[styles.avatarText, { color: theme.chipText }]}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: theme.text }]}>
                Good morning
              </Text>
              <Text style={[styles.profileSub, { color: theme.textDim }]}>
                {streak.currentStreak}-day streak · {streak.totalBeaten} alarms beaten
              </Text>
            </View>
            <View style={[styles.streakChip, { backgroundColor: theme.chipBg }]}>
              {Icon.flame(theme.chipText)}
              <Text style={[styles.streakText, { color: theme.chipText }]}>{streak.currentStreak}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Appearance — features your ThemeButton */}
        <Group label="APPEARANCE" delay={90} theme={theme}>
          <Row
            icon={Icon.moonZ(theme.accent)}
            title="Theme"
            subtitle={isDark ? 'Night sky, waiting for sunrise' : 'The morning it promised'}
            right={<ThemeButton isDark={isDark} onPress={toggleFromButton} theme={theme} />}
            theme={theme}
          />
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2 }}>
            <ModeSegment
              mode={mode}
              onChange={setModeAndTheme}
              theme={theme}
              width={width - 72}
            />
          </View>
        </Group>

        {/* Alarm defaults */}
        <Group label="ALARM" delay={150} theme={theme}>
          <Row
            icon={Icon.wave(theme.accent)}
            title="Sound"
            subtitle={getAlarmSound(defaultSound).name}
            right={<Chevron theme={theme} />}
            onPress={() => setSoundPickerOpen(true)}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={Icon.vibrate(theme.accent)}
            title="Haptics"
            subtitle="Vibrate while ringing"
            right={
              <Toggle value={haptics} onChange={() => setHaptics((h) => !h)} theme={theme} />
            }
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={Icon.bell(theme.accent)}
            title="Auto-silence"
            subtitle="Give up after 10 minutes"
            right={
              <Toggle
                value={autoSilence}
                onChange={() => setAutoSilence((a) => !a)}
                theme={theme}
              />
            }
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={Icon.target(theme.accent)}
            title="Default challenge"
            subtitle="Equations · Standard"
            right={<Chevron theme={theme} />}
            onPress={() => {}}
            theme={theme}
          />
        </Group>

        {/* Account */}
        <Group label="ACCOUNT" delay={210} theme={theme}>
          <Row
            icon={Icon.star(theme.accent)}
            title="Wakey Plus"
            subtitle="Unlock every challenge & sound"
            right={<Chevron theme={theme} />}
            onPress={() => {}}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={Icon.shield(theme.accent)}
            title="Privacy"
            right={<Chevron theme={theme} />}
            onPress={() => {}}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={Icon.info(theme.accent)}
            title="About"
            subtitle="Version 1.0.0"
            right={<Chevron theme={theme} />}
            onPress={() => {}}
            theme={theme}
          />
        </Group>

        {/* Developer / debug tools */}
        <Group label="DEVELOPER / DEBUG" delay={270} theme={theme}>
          <Row
            icon={Icon.hammer(theme.accent)}
            title="Seed 70-Day Demo Data"
            subtitle="Generates 70 days of mock history"
            right={<Chevron theme={theme} />}
            onPress={async () => {
              try {
                await seedDemoInsightsData();
              } catch (err) {
                console.error('Failed to seed:', err);
              }
            }}
            theme={theme}
          />
          <Divider theme={theme} />
          <Row
            icon={Icon.trash(theme.danger)}
            title="Clear All Database Data"
            subtitle="Resets all alarms, history & streaks"
            danger
            right={<Chevron theme={theme} />}
            onPress={async () => {
              try {
                await clearAllDatabaseData();
              } catch (err) {
                console.error('Failed to clear:', err);
              }
            }}
            theme={theme}
          />
        </Group>

        <Text style={[styles.footer, { color: theme.textFaint }]}>
          Made for mornings
        </Text>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      <SoundPicker
        visible={soundPickerOpen}
        selectedId={defaultSound}
        onSelect={handleSelectSound}
        onClose={() => setSoundPickerOpen(false)}
        theme={theme}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 26,
    letterSpacing: 0.3,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 6 },

  /* Theme button (your component's container) */
  themeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Profile */
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 26,
  },
  profileName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
  },
  profileSub: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12.5,
    marginTop: 2,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  streakText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
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

  /* Segment */
  segTrack: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    position: 'relative',
  },
  segThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  segOption: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLabel: {
    fontSize: 12.5,
    letterSpacing: 0.4,
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
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  /* Footer */
  footer: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 28,
  },
});