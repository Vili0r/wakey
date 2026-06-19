/**
 * Screen 16 — the journey summary. Where they are, where they want to be, and
 * the path Wakey puts them on, tied to a concrete habit timeframe (30 days).
 * Pulls their own wake time and outcomes back in so it reads as their plan.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { useOnboarding } from '@/onboarding/state';
import { format12h } from '@/utils/time';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const OUTCOME_PHRASE: Record<string, string> = {
  calm: 'a calmer start',
  time: 'time that’s yours',
  ontime: 'being on time',
  energy: 'all-day energy',
};

function primaryOutcome(ids: string[]): string {
  for (const id of ids) if (OUTCOME_PHRASE[id]) return OUTCOME_PHRASE[id];
  return 'mornings you don’t dread';
}

export default function Summary() {
  const { state } = useOnboarding();
  const wake = format12h(state.wakeHour, state.wakeMinute);

  const steps: { k: string; v: string }[] = [
    { k: 'WHERE YOU ARE', v: 'Snoozing, foggy, fighting the alarm' },
    { k: 'WHERE YOU’RE GOING', v: `Up at ${wake.time} ${wake.period} — and ${primaryOutcome(state.realMorning)}` },
    { k: 'HOW WAKEY GETS YOU THERE', v: 'One earned wake-up a day, building the habit' },
  ];

  return (
    <OnboardingShell
      progress={0.92}
      showBack
      eyebrow="YOUR 30-DAY PLAN"
      title="Wake up on time in 30 days."
      subtitle="Habits form with repetition. Win the morning daily for a month and getting up stops taking willpower at all."
      ctaLabel="I’m ready"
      onCta={() => router.push('/trial-info')}
    >
      <View style={styles.list}>
        {steps.map((s, i) => (
          <Animated.View
            key={s.k}
            entering={FadeInDown.delay(140 + i * 110)
              .duration(440)
              .reduceMotion(ReduceMotion.System)}
            style={[styles.step, i > 0 && styles.stepBorder]}
          >
            <Text style={styles.stepKey}>{s.k}</Text>
            <Text style={styles.stepVal}>{s.v}</Text>
          </Animated.View>
        ))}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: OB.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OB.border,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  step: { paddingVertical: 18 },
  stepBorder: { borderTopWidth: 1, borderTopColor: OB.border },
  stepKey: { fontFamily: OB.mono, fontSize: 10, letterSpacing: 1.8, color: OB.accentText },
  stepVal: { fontFamily: OB.sansSemi, fontSize: 16, color: OB.text, marginTop: 6, lineHeight: 22 },
});
