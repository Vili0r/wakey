/**
 * Screen 8 — the gut-punch. Turn their snooze answer into a concrete yearly
 * cost so the problem feels personal and urgent right before we show the fix.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { StatReveal } from '@/components/onboarding/stat-reveal';
import { snoozeStat } from '@/onboarding/questions';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

export default function RevealStat() {
  const { state } = useOnboarding();
  const stat = snoozeStat(state.snooze);

  // Nobody who snoozes zero times needs scaring — reframe for them.
  const zero = stat.snoozesPerDay === 0;

  return (
    <OnboardingShell
      progress={0.48}
      center
      ctaLabel={zero ? 'Keep it that way' : 'I want those days back'}
      onCta={() => router.push('/q-hardest')}
    >
      {zero ? (
        <StatReveal value="0" unit="MORNINGS WASTED" lead="You said you don’t snooze.">
          <Text style={styles.body}>
            Rare — and worth protecting. Wakey makes sure one rough night never
            turns into a snooze habit.
          </Text>
        </StatReveal>
      ) : (
        <StatReveal
          value={String(stat.hoursPerYear)}
          unit="GROGGY HOURS A YEAR"
          lead={`Snoozing ~${stat.snoozesPerDay}× a morning adds up to`}
        >
          <Text style={styles.body}>
            That’s about{' '}
            <Text style={styles.bodyStrong}>{stat.daysPerYear} full days</Text>{' '}
            a year spent half-awake in the worst part of the day — the foggy
            in-between Wakey is built to end.
          </Text>
        </StatReveal>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
  },
  bodyStrong: { fontFamily: OB.sansSemi, color: OB.text },
});
