/**
 * Paywall 3/3 — the offer + social proof, and the flow's exit. "Start your free
 * trial" persists onboarding (flag + wake time + answers), seeds the first
 * alarm, then routes into the app. The trial-end reminder was already scheduled
 * on the previous screen. Reviews are placeholder content for this build.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import { PaywallShell } from '@/components/onboarding/paywall-shell';
import { completeOnboarding } from '@/onboarding/persistence';
import { PRICING } from '@/onboarding/pricing';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const REVIEWS: { handle: string; stars: number; quote: string }[] = [
  {
    handle: 'david_earlybird',
    stars: 5,
    quote:
      'My room is always tidy now because I have to make my bed to turn off the alarm. My mom thinks I’ve finally grown up 😂',
  },
  {
    handle: 'tomrises',
    stars: 5,
    quote:
      'My wife and I both do the mission now. It’s become our little morning ritual instead of a snooze war.',
  },
  {
    handle: 'mia.mornings',
    stars: 5,
    quote: 'First alarm app I’ve never beaten by sleeping through it. I’m actually up now.',
  },
];

const Stars = ({ n }: { n: number }) => (
  <Text style={styles.stars}>{'★'.repeat(n)}</Text>
);

export default function PaywallPlans() {
  const { state } = useOnboarding();
  const [busy, setBusy] = useState(false);

  const startTrial = async () => {
    if (busy) return;
    setBusy(true);
    await completeOnboarding(state);
    router.replace('/(tabs)/home');
  };

  return (
    <PaywallShell
      title={`${PRICING.trialDays} days for Free`}
      subtitle={`then ${PRICING.perMonth} / month (${PRICING.yearly} billed yearly after trial)`}
      assurance="No Payment Now"
      ctaLabel={busy ? 'Setting up…' : 'Start your FREE trial'}
      busy={busy}
      onCta={startTrial}
      belowCta={
        <Pressable hitSlop={8}>
          <Text style={styles.viewAll}>View All Plans</Text>
        </Pressable>
      }
    >
      <View style={styles.ratingRow}>
        <View style={styles.laurelGroup}>
          <Text style={[styles.laurel, styles.laurelLeft]}>🌿</Text>
          <View style={styles.laurelInner}>
            <Text style={styles.laurelNum}>7K+</Text>
            <Text style={styles.laurelSub}>Ratings</Text>
          </View>
          <Text style={styles.laurel}>🌿</Text>
        </View>
        <View style={styles.ratingCol}>
          <Text style={styles.ratingLabel}>4.8 STAR RATING</Text>
          <Stars n={5} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reviews}
        style={styles.reviewsScroll}
      >
        {REVIEWS.map((r) => (
          <View key={r.handle} style={styles.card}>
            <Stars n={r.stars} />
            <Text style={styles.quote}>“{r.quote}”</Text>
            <Text style={styles.handle}>{r.handle}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.note}>Ratings and reviews are sample content for this build.</Text>
    </PaywallShell>
  );
}

const GOLD = '#F5A623';

const styles = StyleSheet.create({
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 28 },
  laurelGroup: { flexDirection: 'row', alignItems: 'center' },
  laurel: { fontSize: 40, color: OB.text },
  laurelLeft: { transform: [{ scaleX: -1 }] },
  laurelInner: { alignItems: 'center', marginHorizontal: -4 },
  laurelNum: { fontFamily: OB.sansBold, fontSize: 26, color: OB.text },
  laurelSub: { fontFamily: OB.sansMed, fontSize: 13, color: OB.text, marginTop: -2 },
  ratingCol: { alignItems: 'flex-start' },
  ratingLabel: { fontFamily: OB.sansBold, fontSize: 17, color: OB.text, letterSpacing: 0.3 },
  stars: { fontSize: 20, color: GOLD, letterSpacing: 2, marginTop: 4 },
  reviewsScroll: { marginTop: 28, marginHorizontal: -24 },
  reviews: { paddingHorizontal: 24, gap: 14 },
  card: {
    width: 290,
    backgroundColor: OB.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 18,
  },
  quote: { fontFamily: OB.sansMed, fontSize: 15, lineHeight: 22, color: OB.text, marginTop: 10 },
  handle: { fontFamily: OB.sans, fontSize: 13, color: OB.textFaint, marginTop: 14 },
  note: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  viewAll: { fontFamily: OB.sansSemi, fontSize: 15, color: OB.text, textDecorationLine: 'underline' },
});
