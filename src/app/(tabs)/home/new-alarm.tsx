import DayPill from '@/components/day-pill';
import Segmented from '@/components/segmented';
import SFIcon from '@/components/SF-icon';
import SoundPicker from '@/components/sound-picker';
import { DEFAULT_SOUND_ID, getAlarmSound } from '@/utils/alarm-sounds';
import { getDefaultSoundId } from '@/utils/settings-store';
import Wheel, { ITEM_H, WHEEL_PAD } from '@/components/wheel';
import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { alarmStore, Haptics, CHALLENGE_MAPPING, getChallengeId, mapDbToUiAlarm, type Alarm } from '@/utils/alarm-store';
import { ringsIn } from '@/utils/time';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { CHALLENGE_ICONS, CHALLENGES } from './challenge';
import { db } from '@/db/db';
import { alarms as alarmsTable } from '@/db/schema';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';


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
  soundId: string;
};

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];



const DIFFICULTIES = ['gentle', 'standard', 'brutal'] as const;
const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  gentle: 'Gentle',
  standard: 'Standard',
  brutal: 'Brutal',
};

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

  const params = useLocalSearchParams<{ id?: string; challengeId?: string }>();
  const isEdit = !!params.id;
  const navigation = useNavigation();

  // Load alarms reactively using useLiveQuery
  const { data: dbAlarms = [] } = useLiveQuery(db.select().from(alarmsTable));

  const alarms = useMemo(() => {
    return dbAlarms.map(mapDbToUiAlarm);
  }, [dbAlarms]);

  const editAlarm = useMemo(() => {
    if (!params.id) return null;
    return alarms.find((a) => a.id === params.id) || null;
  }, [params.id, alarms]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: isEdit ? 'Edit Alarm' : 'New Alarm',
    });
  }, [isEdit, navigation]);

  if (isEdit && !editAlarm) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <AlarmForm
      key={editAlarm ? editAlarm.id : 'new'}
      editAlarm={editAlarm}
      isEdit={isEdit}
      theme={theme}
      isDark={isDark}
      width={width}
      params={params}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function AlarmForm({
  editAlarm,
  isEdit,
  theme,
  isDark,
  width,
  params,
  onClose,
  onSave,
}: {
  editAlarm: Alarm | null;
  isEdit: boolean;
  theme: any;
  isDark: boolean;
  width: number;
  params: { id?: string; challengeId?: string };
  onClose?: () => void;
  onSave?: (alarm: NewAlarm) => void;
}) {
  const [hourIdx, setHourIdx] = useState(() => {
    if (editAlarm) {
      const h12 = editAlarm.hour % 12 === 0 ? 12 : editAlarm.hour % 12;
      return h12 - 1;
    }
    const h24 = new Date().getHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return h12 - 1;
  });
  const [minuteIdx, setMinuteIdx] = useState(() => {
    if (editAlarm) return editAlarm.minute;
    return new Date().getMinutes();
  });
  const [isPM, setIsPM] = useState(() => {
    if (editAlarm) return editAlarm.hour >= 12;
    return new Date().getHours() >= 12;
  });
  const [label, setLabel] = useState(() => {
    if (editAlarm) return editAlarm.label;
    return '';
  });
  const [days, setDays] = useState<number[]>(() => {
    if (editAlarm) return editAlarm.days;
    return [1, 2, 3, 4, 5];
  });
  const [challengeId, setChallengeId] = useState<string>(() => {
    if (editAlarm) return getChallengeId(editAlarm.challenge);
    return '';
  });

  useEffect(() => {
    if (params.challengeId) {
      setChallengeId(params.challengeId);
    }
  }, [params.challengeId]);

  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>(() => {
    if (editAlarm) return editAlarm.difficulty || 'standard';
    return 'standard';
  });
  const [soundId, setSoundId] = useState<string>(() => {
    if (editAlarm) return editAlarm.soundId ?? DEFAULT_SOUND_ID;
    return DEFAULT_SOUND_ID;
  });
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const soundTouched = useRef(false);
  const [now, setNow] = useState(() => new Date());

  // New alarms inherit the user's default sound from settings — but don't clobber
  // a pick the user already made before this async load resolved.
  useEffect(() => {
    if (editAlarm) return;
    let cancelled = false;
    getDefaultSoundId().then((id) => {
      if (!cancelled && !soundTouched.current) setSoundId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [editAlarm]);

  const pickSound = (id: string) => {
    soundTouched.current = true;
    setSoundId(id);
  };

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

  const selectedChallenge = useMemo(() => {
    return CHALLENGES.find((c) => c.id === challengeId);
  }, [challengeId]);

  // Save button warms up when the alarm is "real" (always valid here,
  // but the entrance pulse sells the commitment)
  const savePressed = useSharedValue(0);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(savePressed.value, [0, 1], [1, 0.97]) }],
  }));

  const toggleDay = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort(),
    );
  };

  const wheelW = Math.min((width - 40) * 0.26, 96);

  const handleSave = () => {
    if (!challengeId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Selection Required', 'Please select a challenge to wake up.');
      return;
    }
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
        soundId,
      });
    } else {
      if (isEdit && params.id) {
        alarmStore.updateAlarm(params.id, {
          hour: hour24,
          minute: minuteIdx,
          label: label.trim() || 'Alarm',
          days,
          challenge: mappedChallenge,
          difficulty,
          soundId,
          enabled: true,
        });
      } else {
        alarmStore.addAlarm({
          hour: hour24,
          minute: minuteIdx,
          label: label.trim() || 'Alarm',
          days,
          challenge: mappedChallenge,
          difficulty,
          soundId,
          enabled: true,
        });
      }
      
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
          entering={FadeInDown.delay(90).springify().damping(26)}
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
          entering={FadeInDown.delay(130).springify().damping(26)}
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
        <Animated.View entering={FadeInDown.delay(180).springify().damping(126)}>
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
        <Animated.View entering={FadeInDown.delay(220).springify().damping(126)}>
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
        <Animated.View entering={FadeInDown.delay(260).springify().damping(126)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            TO SILENCE IT, YOU MUST
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/home/challenge',
                params: { selectedId: challengeId, alarmId: params.id },
              });
            }}
            style={({ pressed }) => [
              styles.challengeSelector,
              {
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.challengeSelectorLeft}>
              <SFIcon
                name={(challengeId && CHALLENGE_ICONS[challengeId] as any) || 'clock.badge.xmark'}
                size={20}
                color={theme.accent}
              />
              <Text style={[
                styles.challengeSelectorName,
                { color: challengeId ? theme.text : theme.textFaint }
              ]}>
                {challengeId ? selectedChallenge?.name : 'Select a challenge to wake up'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.textFaint }]}>→</Text>
          </Pressable>
        </Animated.View>

        {/* Difficulty */}
        <Animated.View
          entering={FadeInDown.delay(300).springify().damping(126)}
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

        {/* Sound */}
        <Animated.View entering={FadeInDown.delay(340).springify().damping(126)}>
          <Text style={[styles.sectionLabel, { color: theme.textFaint }]}>
            SOUND
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSoundPickerOpen(true);
            }}
            style={({ pressed }) => [
              styles.challengeSelector,
              {
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.challengeSelectorLeft}>
              <SFIcon name="speaker.wave.2.fill" size={20} color={theme.accent} />
              <Text style={[styles.challengeSelectorName, { color: theme.text }]}>
                {getAlarmSound(soundId).name}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.textFaint }]}>→</Text>
          </Pressable>
        </Animated.View>

        <View style={{ height: 130 }} />
      </Animated.ScrollView>

      {/* Save */}
      <Animated.View
          entering={FadeInDown.delay(380).springify().damping(122)}
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
                {isEdit ? 'Save alarm' : 'Set alarm'}
              </Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Animated.View>

      <SoundPicker
        visible={soundPickerOpen}
        selectedId={soundId}
        onSelect={pickSound}
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
  wheelColon: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 40,
    marginTop: -6,
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
  challengeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  challengeSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  challengeSelectorName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  chevron: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 16,
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