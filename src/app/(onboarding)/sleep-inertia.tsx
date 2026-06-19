/**
 * Screen 10 — reframe the struggle as biology, not a character flaw. Naming
 * "sleep inertia" takes the blame off the user right after they've admitted the
 * hardest part of their morning, and sets up Wakey as the workaround.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

export default function SleepInertia() {
  return (
    <OnboardingShell
      progress={0.6}
      showBack
      center
      ctaLabel="Continue"
      onCta={() => router.push('/q-currentwake')}
    >
      <View style={styles.body}>
        <Animated.Text
          entering={FadeIn.duration(600).reduceMotion(ReduceMotion.System)}
          style={styles.glyph}
        >
          🧬
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(160).duration(480).reduceMotion(ReduceMotion.System)}
          style={styles.title}
        >
          Biology, Not Laziness
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(280).duration(480).reduceMotion(ReduceMotion.System)}
          style={styles.subtitle}
        >
          When the alarm rings, your prefrontal cortex is still asleep. This is
          ‘Sleep Inertia.’ You can’t think your way out of bed when your brain is
          offline.
        </Animated.Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  glyph: { fontSize: 88, lineHeight: 104, marginBottom: 28 },
  title: {
    fontFamily: OB.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
    color: OB.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 16,
  },
});
