/**
 * Screen 12 — reflect their answers back so the flow feels heard. We map each
 * answer to a "today → with Wakey" pair and close on the outcomes they said
 * they wanted, turning their own words into the case for the app.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { ReflectCard, type ReflectRow } from '@/components/onboarding/reflect-card';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

const HARDEST_MAP: Record<string, ReflectRow> = {
  'leaving-bed': { from: 'Can’t leave the bed', to: 'Up and moving on cue' },
  'snooze-spiral': { from: 'Stuck in the snooze spiral', to: 'No snooze to lean on' },
  'brain-fog': { from: 'Lost in brain fog', to: 'Mind switched on fast' },
  dread: { from: 'Dreading the day', to: 'A calmer start to it' },
};

const MORNINGS_MAP: Record<string, ReflectRow> = {
  groggy: { from: 'Foggy and slow', to: 'Clear-headed sooner' },
  battle: { from: 'A daily fight', to: 'A habit, not a battle' },
  rushed: { from: 'Always rushing', to: 'Time to spare' },
  rough: { from: 'Rough wake-ups', to: 'Mornings you don’t dread' },
};

const CURRENT_MAP: Record<string, ReflectRow> = {
  phone: { from: 'One swipeable alarm', to: 'An alarm you earn off' },
  stacked: { from: 'A wall of alarms', to: 'One that actually works' },
  someone: { from: 'Someone wakes you', to: 'You wake yourself' },
  oversleep: { from: 'Oversleeping often', to: 'On your feet on time' },
};

const OUTCOME_PHRASE: Record<string, string> = {
  calm: 'a calmer start',
  time: 'time that’s yours',
  ontime: 'being on time',
  energy: 'all-day energy',
};

function joinOutcomes(ids: string[]): string {
  const parts = ids.map((id) => OUTCOME_PHRASE[id]).filter(Boolean);
  if (parts.length === 0) return 'the morning you described';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export default function Reflect() {
  const { state } = useOnboarding();

  const rows: ReflectRow[] = [
    state.hardest ? HARDEST_MAP[state.hardest] : null,
    state.mornings ? MORNINGS_MAP[state.mornings] : null,
    state.currentWake ? CURRENT_MAP[state.currentWake] : null,
  ].filter((r): r is ReflectRow => r != null);

  return (
    <OnboardingShell
      progress={0.78}
      showBack
      eyebrow="HERE’S YOUR SHIFT"
      title="We heard you. Here’s what changes."
      ctaLabel="Show me how"
      onCta={() => router.push('/demo-intro')}
    >
      <ReflectCard rows={rows} />
      <Text style={styles.closer}>
        The goal you set: <Text style={styles.closerStrong}>{joinOutcomes(state.realMorning)}</Text>.
        Let’s make the first morning happen now.
      </Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  closer: {
    fontFamily: OB.sans,
    fontSize: 15,
    lineHeight: 22,
    color: OB.textDim,
    marginTop: 22,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  closerStrong: { fontFamily: OB.sansSemi, color: OB.accentText },
});
