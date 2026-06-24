import SFIcon from '@/components/SF-icon';
import { type SFSymbol } from 'expo-symbols';
import { db } from '@/db/db';
import { settings as settingsTable, CHALLENGE_TYPES, DIFFICULTIES, ChallengeType, Difficulty } from '@/db/schema';
import { Haptics } from '@/utils/alarm-store';
import { router } from 'expo-router';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';

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
/* Challenge info & icons                                             */
/* ------------------------------------------------------------------ */
const CHALLENGE_METADATA: Record<ChallengeType, { name: string; desc: string; icon: SFSymbol }> = {
  math: {
    name: 'Equations',
    desc: 'Solve mathematical equations to silence the alarm',
    icon: 'divide',
  },
  pattern: {
    name: 'Pattern recall',
    desc: 'Memorize and recall a sequence of flashing blocks',
    icon: 'square.grid.3x3.fill',
  },
  steps: {
    name: 'Steps',
    desc: 'Get out of bed and walk a target number of paces',
    icon: 'shoeprints.fill',
  },
  pushups: {
    name: 'Push-ups',
    desc: 'Do push-ups in front of your front-facing camera',
    icon: 'figure.strengthtraining.functional',
  },
  squats: {
    name: 'Squats',
    desc: 'Do squats in front of your front-facing camera',
    icon: 'figure.cooldown',
  },
  photo: {
    name: 'Sky photo',
    desc: 'Snap a photo of the morning sky to prove you are awake',
    icon: 'camera.fill',
  },
  'find-item': {
    name: 'Find an item',
    desc: 'Point the camera at a specific item in your home',
    icon: 'magnifyingglass',
  },
  bed: {
    name: 'Make your bed',
    desc: 'Point the camera at your made bed to verify completion',
    icon: 'bed.double.fill',
  },
  meds: {
    name: 'Medication',
    desc: 'Scan a medication bottle barcode or verify daily meds',
    icon: 'pills.fill',
  },
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  gentle: 'Gentle',
  standard: 'Standard',
  brutal: 'Brutal',
};

/* ------------------------------------------------------------------ */
/* Custom Animated Segment Selector                                   */
/* ------------------------------------------------------------------ */
function DifficultySegment({
  value,
  onChange,
  theme,
  width,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  theme: Theme;
  width: number;
}) {
  const segW = (width - 8) / DIFFICULTIES.length;
  const idx = DIFFICULTIES.indexOf(value);
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
      {DIFFICULTIES.map((d) => (
        <Pressable
          key={d}
          style={[styles.segOption, { width: segW }]}
          onPress={() => onChange(d)}
        >
          <Text
            style={[
              styles.segLabel,
              {
                color: d === value ? theme.chipText : theme.textFaint,
                fontFamily: d === value ? 'Sora_600SemiBold' : 'Sora_500Medium',
              },
            ]}
          >
            {DIFFICULTY_LABELS[d]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main Screen                                                        */
/* ------------------------------------------------------------------ */
export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const theme = isDark ? THEMES.dark : THEMES.light;

  // Load current settings from database
  const { data: settingsRows = [] } = useLiveQuery(
    db.select().from(settingsTable).where(eq(settingsTable.id, 1))
  );
  const dbSettings = settingsRows[0];
  const selectedChallenge = dbSettings?.defaultChallenge ?? 'math';
  const selectedDifficulty = dbSettings?.defaultDifficulty ?? 'standard';

  const handlePickChallenge = async (id: ChallengeType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await db
        .update(settingsTable)
        .set({ defaultChallenge: id, updatedAt: new Date() })
        .where(eq(settingsTable.id, 1));
    } catch (err) {
      console.error('Failed to update default challenge settings:', err);
    }
  };

  const handlePickDifficulty = async (diff: Difficulty) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await db
        .update(settingsTable)
        .set({ defaultDifficulty: diff, updatedAt: new Date() })
        .where(eq(settingsTable.id, 1));
    } catch (err) {
      console.error('Failed to update default difficulty settings:', err);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Default challenge</Text>
        <Text style={[styles.subtitle, { color: theme.textFaint }]}>
          Choose the challenge and difficulty pre-filled for new alarms.
        </Text>

        {/* Difficulty Level Segment */}
        <Text style={[styles.sectionHeader, { color: theme.textFaint }]}>DIFFICULTY LEVEL</Text>
        <View style={styles.segmentContainer}>
          <DifficultySegment
            value={selectedDifficulty}
            onChange={handlePickDifficulty}
            theme={theme}
            width={width - 40}
          />
        </View>

        {/* Challenge list */}
        <Text style={[styles.sectionHeader, { color: theme.textFaint }]}>CHALLENGE TYPE</Text>
        <View style={styles.list}>
          {CHALLENGE_TYPES.map((type) => {
            const meta = CHALLENGE_METADATA[type];
            const active = selectedChallenge === type;
            return (
              <Pressable
                key={type}
                onPress={() => handlePickChallenge(type)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? theme.chipBg : theme.surface,
                    borderColor: active ? theme.accent : theme.surfaceBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  <SFIcon
                    name={meta.icon}
                    size={20}
                    color={active ? theme.accent : theme.textFaint}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: theme.text }]}>
                      {meta.name}
                    </Text>
                    <Text style={[styles.rowDesc, { color: theme.textFaint }]}>
                      {meta.desc}
                    </Text>
                  </View>
                </View>
                {active && (
                  <SFIcon name="checkmark.circle.fill" size={22} color={theme.accent} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.dismiss()}
          style={({ pressed }) => [
            styles.doneBtn,
            { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.doneText, { color: theme.fabText }]}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 28,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10.5,
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  segmentContainer: {
    marginBottom: 10,
  },
  list: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderCurve: 'continuous',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    paddingRight: 10,
  },
  rowName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  rowDesc: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  doneBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  doneText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  /* Segmented controller styles matching settings segment */
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
});
