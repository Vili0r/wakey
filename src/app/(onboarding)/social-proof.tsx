/**
 * Screen 19 — "Give us a rating". At this point the user has felt the loop and
 * lit their first streak, so we surface social proof and ride the moment with
 * the native StoreReview prompt (guarded by availability + a fired ref, fired
 * once). Reviews are clearly marked placeholder data for this build.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const REVIEWS: { name: string; initials: string; quote: string }[] = [
  {
    name: 'Georgia P.',
    initials: 'GP',
    quote:
      'Three weeks in and I haven’t snoozed once. The streak is the most motivating thing I’ve ever had on my phone.',
  },
];

export default function SocialProof() {
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    // Let the screen settle, then ride the moment with the native prompt.
    const t = setTimeout(async () => {
      try {
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview();
        }
      } catch {
        // Review prompt is non-essential; never block the flow on it.
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <OnboardingShell
      progress={0.98}
      showBack
      title="Give us a rating"
      ctaLabel="Continue"
      onCta={() => router.push('/setup')}
      footnote={
        <Animated.View
          entering={FadeInDown.delay(120)
            .duration(440)
            .reduceMotion(ReduceMotion.System)}
          style={[styles.card, { alignSelf: 'stretch', marginBottom: 24 }]}
        >
          <View style={styles.cardHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{REVIEWS[0].initials}</Text>
            </View>
            <Text style={styles.name}>{REVIEWS[0].name}</Text>
            <Text style={styles.cardStars}>★★★★★</Text>
          </View>
          <Text style={styles.quote}>{REVIEWS[0].quote}</Text>
        </Animated.View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.laurelRow}>
          <Text style={[styles.laurel, styles.laurelLeft]}>🌿</Text>
          <Text style={styles.stars}>★★★★★</Text>
          <Text style={styles.laurel}>🌿</Text>
        </View>
        <Text style={styles.heroTitle}>Wakey was made to{'\n'}build morning routines</Text>
      </View>
    </OnboardingShell>
  );
}

const GOLD = '#F5A623';

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  laurelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  laurel: { fontSize: 34 },
  laurelLeft: { transform: [{ scaleX: -1 }] },
  stars: { fontSize: 30, color: GOLD, letterSpacing: 2 },
  heroTitle: {
    fontFamily: OB.sansBold,
    fontSize: 24,
    lineHeight: 30,
    color: OB.text,
    textAlign: 'center',
    marginTop: 18,
  },
  list: { gap: 14 },
  card: {
    backgroundColor: OB.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OB.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontFamily: OB.sansBold, fontSize: 14, color: OB.accentDeep },
  name: { flex: 1, fontFamily: OB.sansBold, fontSize: 16, color: OB.text },
  cardStars: { fontSize: 14, color: GOLD, letterSpacing: 1.5 },
  quote: { fontFamily: OB.sans, fontSize: 14.5, lineHeight: 21, color: OB.textDim },
  note: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 20,
  },
});
