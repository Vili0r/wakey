import { Theme, THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { alarmStore, Haptics } from '@/utils/alarm-store';
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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeInDown,
    interpolate,
    interpolateColor,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

export type NewAlarm = {
  hour: number; // 24h
  minute: number;
  label: string;
  days: number[]; // 0 = Sun; empty = rings once
  challengeId: string;
  difficulty: 'gentle' | 'standard' | 'brutal';
};

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CHALLENGE_MAPPING: Record<string, { glyph: string; label: string }> = {
  math: { glyph: '÷', label: 'SOLVE 3 EQUATIONS' },
  shake: { glyph: '≈', label: 'SHAKE × 20' },
  pattern: { glyph: '◫', label: 'PATTERN RECALL' },
  steps: { glyph: '∴', label: 'STEPS × 15' },
};

const CHALLENGES = [
  {
    id: 'math',
    glyph: '÷',
    name: 'Equations',
    desc: 'Solve to silence',
  },
  {
    id: 'shake',
    glyph: '≈',
    name: 'Shake',
    desc: 'Wake your arms first',
  },
  {
    id: 'pattern',
    glyph: '◫',
    name: 'Pattern recall',
    desc: 'Memory before mercy',
  },
  {
    id: 'steps',
    glyph: '∴',
    name: 'Steps',
    desc: 'Out of bed, no debate',
  },
] as const;

const DIFFICULTIES = ['gentle', 'standard', 'brutal'] as const;
const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  gentle: 'Gentle',
  standard: 'Standard',
  brutal: 'Brutal',
};

/* ------------------------------------------------------------------ */
/* Wheel picker                                                        */
/* ------------------------------------------------------------------ */

const ITEM_H = 52;
const VISIBLE = 5; // odd number; 2 above + selected + 2 below
const WHEEL_H = ITEM_H * VISIBLE;
const WHEEL_PAD = (WHEEL_H - ITEM_H) / 2;

function WheelItem({
  index,
  label,
  scrollY,
  theme,
}: {
  index: number;
  label: string;
  scrollY: SharedValue<number>;
  theme: Theme;
}) {
  const aStyle = useAnimatedStyle(() => {
    const center = index * ITEM_H;
    const d = scrollY.value - center; // distance from centerline, px
    return {
      opacity: interpolate(
        Math.abs(d),
        [0, ITEM_H, ITEM_H * 2],
        [1, 0.38, 0.14],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            Math.abs(d),
            [0, ITEM_H, ITEM_H * 2],
            [1, 0.78, 0.6],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotateX: `${interpolate(
            d,
            [-ITEM_H * 2, 0, ITEM_H * 2],
            [-32, 0, 32],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.wheelItem, aStyle]}>
      <Text style={[styles.wheelDigit, { color: theme.text }]}>{label}</Text>
    </Animated.View>
  );
}

function Wheel({
  values,
  initialIndex,
  onChange,
  theme,
  width,
}: {
  values: string[];
  initialIndex: number;
  onChange: (index: number) => void;
  theme: Theme;
  width: number;
}) {
  const scrollY = useSharedValue(initialIndex * ITEM_H);
  const ref = useRef<Animated.ScrollView>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <Animated.ScrollView
      ref={ref}
      style={{ height: WHEEL_H, width }}
      contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
      onMomentumScrollEnd={(e) => {
        const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(Math.min(Math.max(idx, 0), values.length - 1));
      }}
    >
      {values.map((v, i) => (
        <WheelItem key={`${v}-${i}`} index={i} label={v} scrollY={scrollY} theme={theme} />
      ))}
    </Animated.ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control (AM/PM, difficulty)                               */
/* ------------------------------------------------------------------ */

function Segmented({
  options,
  selectedIndex,
  onChange,
  theme,
  width,
}: {
  options: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
  theme: Theme;
  width: number;
}) {
  const segW = (width - 8) / options.length;
  const p = useSharedValue(selectedIndex);
  useEffect(() => {
    p.value = withSpring(selectedIndex, { damping: 18, stiffness: 220 });
  }, [selectedIndex, p]);

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
      {options.map((opt, i) => (
        <Pressable
          key={opt}
          style={[styles.segOption, { width: segW }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(i);
          }}
        >
          <Text
            style={[
              styles.segLabel,
              {
                color: i === selectedIndex ? theme.chipText : theme.textFaint,
                fontFamily: i === selectedIndex ? 'Sora_600SemiBold' : 'Sora_500Medium',
              },
            ]}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Day pill                                                            */
/* ------------------------------------------------------------------ */

function DayPill({
  letter,
  active,
  onPress,
  theme,
}: {
  letter: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(active ? 1 : 0, { damping: 14, stiffness: 260 });
  }, [active, p]);

  const aStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['transparent', theme.accent]),
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      [theme.surfaceBorder, theme.accent],
    ),
    transform: [{ scale: interpolate(p.value, [0, 0.5, 1], [1, 1.12, 1]) }],
  }));
  const tStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [theme.textFaint, theme.fabText]),
  }));

  return (
    <Pressable onPress={onPress} hitSlop={4}>
      <Animated.View style={[styles.dayPill, aStyle]}>
        <Animated.Text style={[styles.dayPillText, tStyle]}>{letter}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Challenge card                                                      */
/* ------------------------------------------------------------------ */

function ChallengeCard({
  glyph,
  name,
  desc,
  selected,
  onPress,
  theme,
}: {
  glyph: string;
  name: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const p = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(selected ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [selected, p]);

  const aStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      [theme.surfaceBorder, theme.accent],
    ),
    backgroundColor: interpolateColor(p.value, [0, 1], [theme.surface, theme.chipBg]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = withSpring(1, { damping: 20, stiffness: 300 }))}
      onPressOut={() => (pressed.value = withSpring(0, { damping: 20, stiffness: 300 }))}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.challengeCard, aStyle]}>
        <Text
          style={[
            styles.challengeGlyph,
            { color: selected ? theme.chipText : theme.textFaint },
          ]}
        >
          {glyph}
        </Text>
        <Text
          style={[
            styles.challengeName,
            { color: selected ? theme.text : theme.textDim },
          ]}
        >
          {name}
        </Text>
        <Text style={[styles.challengeDesc, { color: theme.textFaint }]}>
          {desc}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

function ringsIn(hour24: number, minute: number, days: number[], now: Date) {
  for (let d = 0; d < 8; d++) {
    const c = new Date(now);
    c.setDate(now.getDate() + d);
    c.setHours(hour24, minute, 0, 0);
    const dayOk = days.length === 0 || days.includes(c.getDay());
    if (dayOk && c.getTime() > now.getTime()) {
      const ms = c.getTime() - now.getTime();
      const totalMin = Math.round(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `RINGS IN ${m} MIN`;
      if (h < 24) return `RINGS IN ${h}H ${String(m).padStart(2, '0')}M`;
      const dd = Math.floor(h / 24);
      return `RINGS IN ${dd}D ${h % 24}H`;
    }
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export default function CreateAlarmScreen({
  isDark: propIsDark,
  onClose,
  onSave,
}: {
  isDark?: boolean;
  onClose?: () => void;
  onSave?: (alarm: NewAlarm) => void;
}) {
  const { width } = useWindowDimensions();
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

  const [hourIdx, setHourIdx] = useState(5); // "6"
  const [minuteIdx, setMinuteIdx] = useState(30);
  const [isPM, setIsPM] = useState(false);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [challengeId, setChallengeId] = useState<string>('math');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('standard');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const hour24 = useMemo(() => {
    const h = hourIdx + 1; // 1..12
    if (isPM) return h === 12 ? 12 : h + 12;
    return h === 12 ? 0 : h;
  }, [hourIdx, isPM]);

  const eta = useMemo(
    () => ringsIn(hour24, minuteIdx, days, now),
    [hour24, minuteIdx, days, now],
  );

  // Save button warms up when the alarm is "real" (always valid here,
  // but the entrance pulse sells the commitment)
  const savePressed = useSharedValue(0);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(savePressed.value, [0, 1], [1, 0.97]) }],
  }));

  if (!fontsLoaded) return null;

  const toggleDay = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort(),
    );
  };

  const wheelW = Math.min((width - 40) * 0.26, 96);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const mappedChallenge = CHALLENGE_MAPPING[challengeId] || CHALLENGE_MAPPING.math;

    if (onSave) {
      onSave({
        hour: hour24,
        minute: minuteIdx,
        label: label.trim() || 'Alarm',
        days,
        challengeId,
        difficulty,
      });
    } else {
      alarmStore.addAlarm({
        hour: hour24,
        minute: minuteIdx,
        label: label.trim() || 'Alarm',
        days,
        challenge: mappedChallenge,
        enabled: true,
      });
      
      if (onClose) {
        onClose();
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/home');
      }
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Time wheels */}
        <Animated.View
          entering={FadeInDown.delay(90).springify().damping(18)}
          style={styles.wheelsWrap}
        >
          {/* Centerline band */}
          <View
            pointerEvents="none"
            style={[
              styles.centerBand,
              {
                top: WHEEL_PAD,
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
              },
            ]}
          />
          <View style={styles.wheelsRow}>
            <Wheel
              values={HOURS}
              initialIndex={hourIdx}
              onChange={setHourIdx}
              theme={theme}
              width={wheelW}
            />
            <Text style={[styles.wheelColon, { color: theme.accentDeep }]}>:</Text>
            <Wheel
              values={MINUTES}
              initialIndex={minuteIdx}
              onChange={setMinuteIdx}
              theme={theme}
              width={wheelW}
            />
          </View>
        </Animated.View>

        {/* AM / PM */}
        <Animated.View
          entering={FadeInDown.delay(130).springify().damping(18)}
          style={{ alignItems: 'center', marginTop: 14 }}
        >
          <Segmented
            options={['AM', 'PM']}
            selectedIndex={isPM ? 1 : 0}
            onChange={(i) => setIsPM(i === 1)}
            theme={theme}
            width={150}
          />
        </Animated.View>

        {/* Repeat days */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            REPEAT
          </Text>
          <View style={styles.daysRow}>
            {DAY_LETTERS.map((letter, i) => (
              <DayPill
                key={`${letter}-${i}`}
                letter={letter}
                active={days.includes(i)}
                onPress={() => toggleDay(i)}
                theme={theme}
              />
            ))}
          </View>
          <Text style={[styles.helperText, { color: theme.textFaint }]}>
            {days.length === 0
              ? 'Rings once, then retires.'
              : days.length === 7
                ? 'Every single day. Respect.'
                : ' '}
          </Text>
        </Animated.View>

        {/* Label */}
        <Animated.View entering={FadeInDown.delay(220).springify().damping(18)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            LABEL
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Weekday wake-up"
            placeholderTextColor={theme.textFaint}
            style={[
              styles.labelInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
                color: theme.text,
              },
            ]}
            returnKeyType="done"
            maxLength={32}
          />
        </Animated.View>

        {/* Challenge */}
        <Animated.View entering={FadeInDown.delay(260).springify().damping(18)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            TO SILENCE IT, YOU MUST
          </Text>
          <View style={styles.challengeRow}>
            <ChallengeCard
              {...CHALLENGES[0]}
              selected={challengeId === CHALLENGES[0].id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setChallengeId(CHALLENGES[0].id);
              }}
              theme={theme}
            />
            <ChallengeCard
              {...CHALLENGES[1]}
              selected={challengeId === CHALLENGES[1].id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setChallengeId(CHALLENGES[1].id);
              }}
              theme={theme}
            />
          </View>
          <View style={styles.challengeRow}>
            <ChallengeCard
              {...CHALLENGES[2]}
              selected={challengeId === CHALLENGES[2].id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setChallengeId(CHALLENGES[2].id);
              }}
              theme={theme}
            />
            <ChallengeCard
              {...CHALLENGES[3]}
              selected={challengeId === CHALLENGES[3].id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setChallengeId(CHALLENGES[3].id);
              }}
              theme={theme}
            />
          </View>
        </Animated.View>

        {/* Difficulty */}
        <Animated.View
          entering={FadeInDown.delay(300).springify().damping(18)}
          style={{ marginTop: 6 }}
        >
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            DIFFICULTY
          </Text>
          <Segmented
            options={DIFFICULTIES.map((d) => DIFFICULTY_LABELS[d])}
            selectedIndex={DIFFICULTIES.indexOf(difficulty)}
            onChange={(i) => setDifficulty(DIFFICULTIES[i])}
            theme={theme}
            width={width - 40}
          />
          <Text style={[styles.helperText, { color: theme.textFaint }]}>
            {difficulty === 'gentle' && 'One round. A polite nudge.'}
            {difficulty === 'standard' && 'Three rounds. Fair fight.'}
            {difficulty === 'brutal' && 'Five rounds, no snooze. Godspeed.'}
          </Text>
        </Animated.View>

        <View style={{ height: 130 }} />
      </Animated.ScrollView>

      {/* Save */}
      <Animated.View
        entering={FadeInDown.delay(380).springify().damping(16)}
        style={styles.saveWrap}
      >
        <Pressable
          onPress={handleSave}
          onPressIn={() =>
            (savePressed.value = withSpring(1, { damping: 20, stiffness: 300 }))
          }
          onPressOut={() =>
            (savePressed.value = withSpring(0, { damping: 20, stiffness: 300 }))
          }
        >
          <Animated.View style={saveStyle}>
            <LinearGradient
              colors={[theme.accent, theme.accentDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtn}
            >
              <Text style={[styles.saveText, { color: theme.fabText }]}>
                Set alarm
              </Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Animated.View>
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
    fontSize: 24,
    letterSpacing: 0.3,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  /* ETA */
  eta: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    letterSpacing: 2.4,
    textAlign: 'center',
    marginBottom: 4,
  },

  /* Wheels */
  wheelsWrap: { position: 'relative' },
  centerBand: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    height: ITEM_H,
    borderRadius: 16,
    borderWidth: 1,
  },
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelDigit: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 44,
    letterSpacing: -1,
    paddingHorizontal: 10,
  },
  wheelColon: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 40,
    marginTop: -6,
  },

  /* Segmented */
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
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLabel: {
    fontSize: 12.5,
    letterSpacing: 0.6,
  },

  /* Sections */
  sectionLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 2,
    marginTop: 26,
    marginBottom: 12,
  },
  helperText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    marginTop: 10,
    minHeight: 16,
  },

  /* Days */
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
  },

  /* Label input */
  labelInput: {
    fontFamily: 'Sora_400Regular',
    fontSize: 15,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },

  /* Challenge */
  challengeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  challengeCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  challengeGlyph: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 20,
    marginBottom: 8,
  },
  challengeName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    marginBottom: 3,
  },
  challengeDesc: {
    fontFamily: 'Sora_400Regular',
    fontSize: 11.5,
  },

  /* Save */
  saveWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 34,
  },
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#FF6E50',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  saveText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15.5,
    letterSpacing: 0.4,
  },
});