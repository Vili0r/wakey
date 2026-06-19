/**
 * Screen 15 (climax payoff) — Day 1 streak. Beating the demo just lit the first
 * day, so we celebrate it and, at this emotional high, ask for a review via the
 * native StoreReview prompt. Timed here on purpose: never before the win, and
 * only once (guarded by availability + a fired ref).
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { StreakReveal } from '@/components/onboarding/streak-reveal';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';

export default function Streak() {
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    // Fire slightly after the reveal settles so the prompt rides the high.
    const t = setTimeout(async () => {
      try {
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview();
        }
      } catch {
        // Review prompt is non-essential; never block the flow on it.
      }
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <OnboardingShell
      progress={0.9}
      center
      ctaLabel="Keep it going"
      onCta={() => router.push('/summary')}
    >
      <StreakReveal count={1} />
      <Text style={styles.title}>Day one is yours.</Text>
      <Text style={styles.body}>
        That’s how every morning will feel: a small win the moment you wake. Keep
        the streak alive and getting up stops being a fight.
      </Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: OB.serif,
    fontSize: 34,
    lineHeight: 38,
    color: OB.text,
    textAlign: 'center',
    marginTop: 28,
  },
  body: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 6,
  },
});
