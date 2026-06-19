/**
 * Screen 19 — final social proof before the paywall. Ratings and quotes are
 * clearly marked placeholder data for this build; swap for real reviews later.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const QUOTES: { quote: string; who: string }[] = [
  { quote: 'First alarm app I’ve never beaten by sleeping through it. I’m actually up now.', who: 'sample reviewer' },
  { quote: 'The streak got me. Three weeks in and I haven’t snoozed once.', who: 'sample reviewer' },
  { quote: 'Dragging the sun to commit sounds silly. It works on me every morning.', who: 'sample reviewer' },
];

export default function SocialProof() {
  return (
    <OnboardingShell
      progress={0.98}
      showBack
      eyebrow="PLACEHOLDER REVIEWS"
      title="You’re in good company."
      ctaLabel="See my plan"
      onCta={() => router.push('/problem')}
    >
      <View style={styles.ratingRow}>
        <Text style={styles.ratingNum}>4.8</Text>
        <View>
          <Text style={styles.stars}>★★★★★</Text>
          <Text style={styles.ratingSub}>sample rating · placeholder data</Text>
        </View>
      </View>

      <View style={styles.quotes}>
        {QUOTES.map((q, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(140 + i * 110)
              .duration(440)
              .reduceMotion(ReduceMotion.System)}
            style={styles.quoteCard}
          >
            <Text style={styles.stars}>★★★★★</Text>
            <Text style={styles.quoteText}>“{q.quote}”</Text>
            <Text style={styles.quoteWho}>— {q.who}</Text>
          </Animated.View>
        ))}
      </View>

      <Text style={styles.note}>Reviews shown are sample content for this build.</Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: OB.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 20,
  },
  ratingNum: { fontFamily: OB.serif, fontSize: 56, color: OB.accentDeep, lineHeight: 58 },
  stars: { fontSize: 15, color: OB.accent, letterSpacing: 2 },
  ratingSub: { fontFamily: OB.sans, fontSize: 12, color: OB.textDim, marginTop: 4 },
  quotes: { gap: 12, marginTop: 16 },
  quoteCard: {
    backgroundColor: OB.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 18,
  },
  quoteText: { fontFamily: OB.sansMed, fontSize: 14.5, lineHeight: 21, color: OB.text, marginTop: 8 },
  quoteWho: { fontFamily: OB.sans, fontSize: 12, color: OB.textFaint, marginTop: 8 },
  note: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 20,
  },
});
