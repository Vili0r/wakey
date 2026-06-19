/**
 * Screen 17 — honesty up front: Wakey is paid, but starts with a free trial.
 * Anchor the cost to something real (a single coffee a month) so the price
 * feels trivial next to the mornings they're reclaiming.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { TRIAL_DAYS } from '@/onboarding/reminder';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const POINTS: string[] = [
  `${TRIAL_DAYS} days free — full access, nothing locked`,
  'We’ll remind you the day before it ends',
  'Cancel in two taps, no charge if you do',
];

export default function TrialInfo() {
  return (
    <OnboardingShell
      progress={0.95}
      showBack
      eyebrow="STRAIGHT WITH YOU"
      title="Less than a coffee a month."
      subtitle="Wakey is a paid app, and you start free. One skipped coffee covers a whole month of mornings you actually own."
      ctaLabel="Sounds fair"
      onCta={() => router.push('/commitment')}
    >
      <View style={styles.coffeeRow}>
        <View style={styles.coffeeCol}>
          <Text style={styles.coffeeLabel}>ONE COFFEE</Text>
          <Text style={styles.coffeeValue}>$4.50</Text>
          <Text style={styles.coffeeSub}>gone by noon</Text>
        </View>
        <Text style={styles.vs}>vs</Text>
        <View style={styles.coffeeCol}>
          <Text style={[styles.coffeeLabel, { color: OB.accentText }]}>ONE MONTH</Text>
          <Text style={[styles.coffeeValue, { color: OB.accentDeep }]}>$3.99</Text>
          <Text style={styles.coffeeSub}>30 better mornings</Text>
        </View>
      </View>

      <View style={styles.list}>
        {POINTS.map((p, i) => (
          <Animated.View
            key={p}
            entering={FadeInDown.delay(160 + i * 90)
              .duration(420)
              .reduceMotion(ReduceMotion.System)}
            style={styles.point}
          >
            <Text style={styles.tick}>✓</Text>
            <Text style={styles.pointText}>{p}</Text>
          </Animated.View>
        ))}
      </View>

      <Text style={styles.note}>Prices shown are placeholders for this build.</Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  coffeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OB.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 22,
    marginTop: 4,
  },
  coffeeCol: { flex: 1, alignItems: 'center' },
  coffeeLabel: { fontFamily: OB.mono, fontSize: 10, letterSpacing: 1.6, color: OB.textFaint },
  coffeeValue: { fontFamily: OB.serif, fontSize: 40, color: OB.text, marginTop: 4 },
  coffeeSub: { fontFamily: OB.sans, fontSize: 12, color: OB.textDim, marginTop: 2 },
  vs: { fontFamily: OB.sansMed, fontSize: 13, color: OB.textFaint, paddingHorizontal: 8 },
  list: { gap: 12, marginTop: 22 },
  point: { flexDirection: 'row', alignItems: 'center' },
  tick: { fontFamily: OB.sansBold, fontSize: 15, color: OB.accentDeep, width: 26 },
  pointText: { flex: 1, fontFamily: OB.sansMed, fontSize: 14.5, color: OB.text },
  note: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 22,
  },
});
