/**
 * Screen 13 — set up the climax: let them feel the core loop before paying.
 * A short, low-pressure framing so the interactive demo that follows lands as
 * "oh, that's satisfying" rather than "a test".
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import HorizonArc from '@/components/horizon-arc';
import { THEMES } from '@/constants/theme';
import { router } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

export default function DemoIntro() {
  const { width } = useWindowDimensions();
  return (
    <OnboardingShell
      progress={0.82}
      showBack
      eyebrow="TRY IT NOW"
      title="Feel the moment you wake up."
      subtitle="This is the whole idea: a quick challenge stands between you and silence. Beat it and the alarm stops. Let’s do one — no alarm blaring, promise."
      ctaLabel="Start the demo"
      onCta={() => router.push('/demo-challenge')}
    >
      <Animated.View
        entering={FadeIn.delay(200).duration(600).reduceMotion(ReduceMotion.System)}
        style={styles.art}
      >
        <HorizonArc width={width - 48} progress={0.5} theme={THEMES.light} />
        <Text style={styles.caption}>One challenge. One tap at a time. You’ve got this.</Text>
      </Animated.View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', marginTop: 24 },
  caption: {
    fontFamily: OB.sans,
    fontSize: 14,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 16,
  },
});
