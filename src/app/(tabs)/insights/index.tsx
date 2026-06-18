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
import { useEffect, useMemo, useState } from 'react';
import {
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
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

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
    track: 'rgba(238, 240, 255, 0.08)',
    fabText: '#1A1206',
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
    track: 'rgba(24, 28, 46, 0.06)',
    fabText: '#FFFFFF',
  },
};

type Theme = typeof THEMES.dark;

/* ------------------------------------------------------------------ */
/* Data shape (wire to your queries; defaults match the seed)          */
/* ------------------------------------------------------------------ */

export type InsightsData = {
  currentStreak: number;
  longestStreak: number;
  totalBeaten: number;
  avgSilenceSec: number;
  onTimeRate: number; // 0..1
  snoozeRate: number; // 0..1
  // Wake time per weekday (minutes since midnight); null = no alarm beaten.
  rhythm: { label: string; minutes: number | null }[];
  targetMinutes: number; // dotted target line on the rhythm chart
  // Last 70 days, oldest→newest, beatenCount per day.
  heatmap: number[];
  // Per challenge performance.
  challenges: { glyph: string; name: string; beaten: number; total: number }[];
};

const DEFAULT_DATA: InsightsData = {
  currentStreak: 3,
  longestStreak: 12,
  totalBeaten: 47,
  avgSilenceSec: 42,
  onTimeRate: 0.86,
  snoozeRate: 0.21,
  rhythm: [
    { label: 'M', minutes: 6 * 60 + 34 },
    { label: 'T', minutes: 6 * 60 + 41 },
    { label: 'W', minutes: 6 * 60 + 29 },
    { label: 'T', minutes: 6 * 60 + 52 },
    { label: 'F', minutes: 6 * 60 + 38 },
    { label: 'S', minutes: 7 * 60 + 58 },
    { label: 'S', minutes: null },
  ],
  targetMinutes: 6 * 60 + 30,
  heatmap: Array.from({ length: 70 }, (_, i) => {
    // a plausible-looking pattern, denser lately
    const recency = i / 70;
    const r = Math.random();
    if (r < 0.55 - recency * 0.25) return 0;
    if (r < 0.9) return 1;
    return 2;
  }),
  challenges: [
    { glyph: '÷', name: 'Equations', beaten: 28, total: 31 },
    { glyph: '≈', name: 'Shake', beaten: 12, total: 13 },
    { glyph: '◫', name: 'Pattern', beaten: 5, total: 8 },
    { glyph: '∴', name: 'Steps', beaten: 2, total: 2 },
  ],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

/* ------------------------------------------------------------------ */
/* Wake-rhythm bar chart                                               */
/* ------------------------------------------------------------------ */

function RhythmBar({
  x,
  width,
  fullH,
  baseY,
  delay,
  theme,
  faded,
}: {
  x: number;
  width: number;
  fullH: number;
  baseY: number;
  delay: number;
  theme: Theme;
  faded?: boolean;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
  }, [p, delay]);

  const animatedProps = useAnimatedProps(() => ({
    height: Math.max(fullH * p.value, 0.001),
    y: baseY - fullH * p.value,
  }));

  return (
    <AnimatedRect
      x={x}
      width={width}
      rx={width / 2}
      fill={faded ? theme.track : 'url(#barGrad)'}
      animatedProps={animatedProps}
    />
  );
}

function RhythmChart({
  data,
  target,
  theme,
  width,
}: {
  data: InsightsData['rhythm'];
  target: number;
  theme: Theme;
  width: number;
}) {
  const H = 150;
  const topPad = 16;
  const bottomPad = 8;
  const usable = H - topPad - bottomPad;

  const present = data.filter((d) => d.minutes != null) as {
    label: string;
    minutes: number;
  }[];
  const values = present.map((d) => d.minutes).concat(target);
  const min = Math.min(...values) - 12;
  const max = Math.max(...values) + 12;
  const span = Math.max(max - min, 1);

  const yFor = (m: number) => topPad + ((max - m) / span) * usable;
  const barW = 14;
  const gap = (width - barW * data.length) / (data.length + 1);
  const baseY = H - bottomPad;

  const targetY = yFor(target);

  const avg =
    present.length > 0
      ? Math.round(present.reduce((s, d) => s + d.minutes, 0) / present.length)
      : null;

  return (
    <View>
      <Svg width={width} height={H}>
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.accent} />
            <Stop offset="100%" stopColor={theme.accentDeep} />
          </LinearGradient>
        </Defs>

        {/* Target line — your intended wake time */}
        <Line
          x1={0}
          x2={width}
          y1={targetY}
          y2={targetY}
          stroke={theme.textFaint}
          strokeWidth={1}
          strokeDasharray="2 5"
        />

        {data.map((d, i) => {
          const x = gap + i * (barW + gap);
          if (d.minutes == null) {
            // faint stub for a day with no beaten alarm
            return (
              <RhythmBar
                key={i}
                x={x}
                width={barW}
                fullH={14}
                baseY={baseY}
                delay={i * 70}
                theme={theme}
                faded
              />
            );
          }
          const top = yFor(d.minutes);
          return (
            <RhythmBar
              key={i}
              x={x}
              width={barW}
              fullH={baseY - top}
              baseY={baseY}
              delay={i * 70}
              theme={theme}
            />
          );
        })}
      </Svg>

      {/* Day labels */}
      <View style={[styles.rhythmLabels, { width }]}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.rhythmLabel,
              { color: d.minutes == null ? theme.textFaint : theme.textDim, width: barW },
            ]}
          >
            {d.label}
          </Text>
        ))}
      </View>

      {avg != null && (
        <View style={styles.rhythmCaption}>
          <View style={[styles.captionDash, { borderColor: theme.textFaint }]} />
          <Text style={[styles.rhythmCaptionText, { color: theme.textFaint }]}>
            TARGET {fmtClock(target)} · AVG {fmtClock(avg)}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Streak heatmap                                                      */
/* ------------------------------------------------------------------ */

function Heatmap({
  values,
  theme,
  width,
}: {
  values: number[];
  theme: Theme;
  width: number;
}) {
  const cols = Math.ceil(values.length / 7);
  const gap = 4;
  const cell = (width - gap * (cols - 1)) / cols;
  const H = cell * 7 + gap * 6;

  const fillFor = (v: number) => {
    if (v <= 0) return theme.track;
    if (v === 1) return theme.accent;
    return theme.accentDeep;
  };
  const opacityFor = (v: number) => (v <= 0 ? 1 : v === 1 ? 0.55 : 1);

  return (
    <Svg width={width} height={H}>
      {values.map((v, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        return (
          <Rect
            key={i}
            x={col * (cell + gap)}
            y={row * (cell + gap)}
            width={cell}
            height={cell}
            rx={3}
            fill={fillFor(v)}
            opacity={opacityFor(v)}
          />
        );
      })}
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Challenge performance bar                                           */
/* ------------------------------------------------------------------ */

function ChallengeBar({
  glyph,
  name,
  beaten,
  total,
  delay,
  theme,
}: {
  glyph: string;
  name: string;
  beaten: number;
  total: number;
  delay: number;
  theme: Theme;
}) {
  const pct = total > 0 ? beaten / total : 0;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [p, pct, delay]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${p.value * 100}%`,
  }));

  return (
    <View style={styles.chRow}>
      <Text style={[styles.chGlyph, { color: theme.chipText }]}>{glyph}</Text>
      <View style={{ flex: 1 }}>
        <View style={styles.chTop}>
          <Text style={[styles.chName, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.chCount, { color: theme.textFaint }]}>
            {beaten}/{total}
          </Text>
        </View>
        <View style={[styles.chTrack, { backgroundColor: theme.track }]}>
          <Animated.View style={[styles.chFill, fillStyle]}>
            <View style={[styles.chFillInner, { backgroundColor: theme.accent }]} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

function StatTile({
  value,
  unit,
  label,
  theme,
}: {
  value: string;
  unit?: string;
  label: string;
  theme: Theme;
}) {
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[styles.tileValue, { color: theme.text }]}>{value}</Text>
        {unit ? (
          <Text style={[styles.tileUnit, { color: theme.textDim }]}> {unit}</Text>
        ) : null}
      </View>
      <Text style={[styles.tileLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Period segment                                                      */
/* ------------------------------------------------------------------ */

const PERIODS = ['Week', 'Month', 'Year'] as const;

function PeriodSegment({
  index,
  onChange,
  theme,
  width,
}: {
  index: number;
  onChange: (i: number) => void;
  theme: Theme;
  width: number;
}) {
  const segW = (width - 8) / PERIODS.length;
  const p = useSharedValue(index);
  useEffect(() => {
    p.value = withSpring(index, { damping: 18, stiffness: 220 });
  }, [index, p]);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * segW }],
  }));

  return (
    <View
      style={[
        styles.segTrack,
        { width, backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
      ]}
    >
      <Animated.View
        style={[
          styles.segThumb,
          { width: segW, backgroundColor: theme.chipBg, borderColor: theme.accent },
          thumbStyle,
        ]}
      />
      {PERIODS.map((label, i) => (
        <Pressable
          key={label}
          style={[styles.segOption, { width: segW }]}
          onPress={() => onChange(i)}
        >
          <Text
            style={[
              styles.segLabel,
              {
                color: i === index ? theme.chipText : theme.textFaint,
                fontFamily: i === index ? 'Sora_600SemiBold' : 'Sora_500Medium',
              },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function InsightsScreen({
  isDark: propIsDark,
  data = DEFAULT_DATA,
  onClose,
}: {
  isDark?: boolean;
  data?: InsightsData;
  onClose?: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const isDark = propIsDark ?? (systemScheme !== 'light');
  const theme = isDark ? THEMES.dark : THEMES.light;

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular_Italic,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    SpaceMono_400Regular,
  });

  const [period, setPeriod] = useState(0);

  const cardW = width - 40; // screen padding 20 each side
  const innerW = cardW - 40; // card padding 20 each side

  // Sun rises as the streak grows toward the longest — a tiny progress halo.
  const streakProgress = useMemo(
    () =>
      data.longestStreak > 0
        ? Math.min(data.currentStreak / data.longestStreak, 1)
        : 0,
    [data.currentStreak, data.longestStreak],
  );

  if (!fontsLoaded) return null;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Animated.ScrollView
        contentContainerStyle={(styles.scroll, { marginTop: insets.top + 50 })}
        showsVerticalScrollIndicator={false}
      >
        {/* Period segment */}
        <Animated.View
          entering={FadeInDown.delay(40).springify().damping(18)}
          style={{ alignItems: 'center', marginBottom: 4 }}
        >
          <PeriodSegment index={period} onChange={setPeriod} theme={theme} width={width - 40} />
        </Animated.View>

        {/* Streak hero */}
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
          <View
            style={[
              styles.hero,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <View style={styles.heroHalo}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Defs>
                  <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor={theme.accent} />
                    <Stop offset="100%" stopColor={theme.accentDeep} />
                  </LinearGradient>
                </Defs>
                {/* track */}
                <Circle
                  cx={60}
                  cy={60}
                  r={50}
                  stroke={theme.track}
                  strokeWidth={6}
                  fill="none"
                />
                {/* progress arc */}
                <Circle
                  cx={60}
                  cy={60}
                  r={50}
                  stroke="url(#ring)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - streakProgress)}
                  transform="rotate(-90 60 60)"
                />
              </Svg>
              <View style={styles.heroCenter}>
                <Text style={[styles.heroNumber, { color: theme.text }]}>
                  {data.currentStreak}
                </Text>
                <Text style={[styles.heroUnit, { color: theme.accentDeep }]}>
                  DAY STREAK
                </Text>
              </View>
            </View>

            <Text style={[styles.heroSub, { color: theme.textDim }]}>
              {data.currentStreak >= data.longestStreak && data.currentStreak > 0
                ? 'Your best run yet. Keep the sun coming up.'
                : `Longest run: ${data.longestStreak} days`}
            </Text>
          </View>
        </Animated.View>

        {/* Stat tiles */}
        <Animated.View
          entering={FadeInDown.delay(130).springify().damping(18)}
          style={styles.tileGrid}
        >
          <StatTile value={String(data.totalBeaten)} label="ALARMS BEATEN" theme={theme} />
          <StatTile value={String(data.longestStreak)} unit="days" label="LONGEST STREAK" theme={theme} />
          <StatTile value={String(data.avgSilenceSec)} unit="sec" label="AVG TO SILENCE" theme={theme} />
          <StatTile
            value={`${Math.round(data.onTimeRate * 100)}`}
            unit="%"
            label="ON-TIME RATE"
            theme={theme}
          />
        </Animated.View>

        {/* Wake rhythm */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            WAKE RHYTHM
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <RhythmChart
              data={data.rhythm}
              target={data.targetMinutes}
              theme={theme}
              width={innerW}
            />
          </View>
        </Animated.View>

        {/* Heatmap */}
        <Animated.View entering={FadeInDown.delay(230).springify().damping(18)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            LAST 10 WEEKS
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <Heatmap values={data.heatmap} theme={theme} width={innerW} />
            <View style={styles.legendRow}>
              <Text style={[styles.legendText, { color: theme.textFaint }]}>Less</Text>
              <View style={[styles.legendCell, { backgroundColor: theme.track }]} />
              <View
                style={[styles.legendCell, { backgroundColor: theme.accent, opacity: 0.55 }]}
              />
              <View style={[styles.legendCell, { backgroundColor: theme.accentDeep }]} />
              <Text style={[styles.legendText, { color: theme.textFaint }]}>More</Text>
            </View>
          </View>
        </Animated.View>

        {/* Challenge performance */}
        <Animated.View entering={FadeInDown.delay(280).springify().damping(18)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            CHALLENGE PERFORMANCE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, gap: 16 },
            ]}
          >
            {data.challenges.map((c, i) => (
              <ChallengeBar key={c.name} {...c} delay={300 + i * 90} theme={theme} />
            ))}
          </View>
        </Animated.View>

        <Text style={[styles.footer, { color: theme.textFaint }]}>
          Every bar is a morning you won.
        </Text>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, padding: 10 },

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

  /* Hero */
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  heroHalo: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNumber: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 56,
    lineHeight: 60,
  },
  heroUnit: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9.5,
    letterSpacing: 2,
    marginTop: 2,
  },
  heroSub: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },

  /* Tiles */
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  tile: {
    // two per row, accounting for the 12 gap
    width: '47.5%',
    flexGrow: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  tileValue: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 40,
    lineHeight: 44,
  },
  tileUnit: {
    fontFamily: 'Sora_500Medium',
    fontSize: 13,
  },
  tileLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9.5,
    letterSpacing: 1.5,
    marginTop: 6,
  },

  /* Cards / sections */
  sectionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 2,
    marginTop: 28,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },

  /* Rhythm chart */
  rhythmLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 0,
  },
  rhythmLabel: {
    fontFamily: 'Sora_500Medium',
    fontSize: 11,
    textAlign: 'center',
  },
  rhythmCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  captionDash: {
    width: 16,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  rhythmCaptionText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9.5,
    letterSpacing: 1.2,
  },

  /* Heatmap */
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  legendCell: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
    marginHorizontal: 2,
  },

  /* Challenge bars */
  chRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chGlyph: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 18,
    width: 20,
    textAlign: 'center',
  },
  chTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 7,
  },
  chName: {
    fontFamily: 'Sora_500Medium',
    fontSize: 13.5,
  },
  chCount: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  chTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  chFill: {
    height: '100%',
  },
  chFillInner: {
    flex: 1,
    borderRadius: 4,
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

  /* Footer */
  footer: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginTop: 28,
  },
});