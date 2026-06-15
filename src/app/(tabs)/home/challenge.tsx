import ChallengeCard from '@/components/challenge-card';
import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Haptics } from '@/utils/alarm-store';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CHALLENGES = [
  {
    id: 'math',
    glyph: '÷',
    icon: 'plus.forwardslash.minus',
    name: 'Equations',
    desc: 'Solve to silence',
  },
  {
    id: 'shake',
    glyph: '≈',
    icon: 'hand.wave',
    name: 'Shake',
    desc: 'Wake your arms first',
  },
  {
    id: 'pattern',
    glyph: '◫',
    icon: 'square.grid.2x2',
    name: 'Pattern recall',
    desc: 'Memory before mercy',
  },
  {
    id: 'steps',
    glyph: '∴',
    icon: 'figure.walk',
    name: 'Steps',
    desc: 'Out of bed, no debate',
  },
  {
    id: 'pushups',
    glyph: '⤓',
    icon: 'figure.strengthtraining.functional',
    name: 'Push-ups',
    desc: 'Earn it from the floor',
  },
  {
    id: 'squats',
    glyph: '⇕',
    icon: 'figure.strengthtraining.traditional',
    name: 'Squats',
    desc: 'Down, up, and awake',
  },
  {
    id: 'photo',
    glyph: '◎',
    icon: 'camera.viewfinder',
    name: 'Sky photo',
    desc: 'Prove the sky is bright',
  },
  {
    id: 'bed',
    glyph: '▭',
    icon: 'bed.double',
    name: 'Make your bed',
    desc: 'No crawling back in',
  },
  {
    id: 'meds',
    glyph: '✚',
    icon: 'pills',
    name: 'Medication',
    desc: 'Take it before you forget',
  },
  {
    id: 'scan',
    glyph: '⊡',
    icon: 'barcode.viewfinder',
    name: 'Code hunt',
    desc: 'Scan a code across the room',
  },
] as const;

// Kept for any call sites still reading the standalone map.
export const CHALLENGE_ICONS: Record<string, string> = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c.icon]),
);

// Chunk into rows of two for the grid.
const ROWS = CHALLENGES.reduce<(typeof CHALLENGES)[number][][]>((acc, c, i) => {
  if (i % 2 === 0) acc.push([c]);
  else acc[acc.length - 1].push(c);
  return acc;
}, []);

export default function ChallengeSelectScreen() {
  const systemScheme = useColorScheme();
  const isDark = systemScheme !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selectedId?: string }>();
  const activeId = params.selectedId || 'math';

  const selectChallenge = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate({
      pathname: '/(tabs)/home/new-alarm',
      params: { challengeId: id },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]} collapsable={false}>
      {/* Header bar */}
      <View style={styles.header} collapsable={false}>
        <Text style={[styles.title, { color: theme.text }]}>Select Challenge</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.grid, { paddingTop: insets.top - 20, paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {ROWS.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((c) => (
              <ChallengeCard
                key={c.id}
                {...c}
                selected={activeId === c.id}
                onPress={() => selectChallenge(c.id)}
                theme={theme}
              />
            ))}
            {/* keep the last odd card from stretching full-width */}
            {row.length === 1 && <View style={styles.spacer} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 32,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 16,
  },
  container: {
    flex: 1,
    width: '100%',
  },
  grid: {
    gap: 12,
    width: '100%',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    width: '100%',
    maxWidth: 500,
  },
  spacer: {
    flex: 1,
  },
});