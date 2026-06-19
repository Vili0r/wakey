/**
 * Present the solution (final beat before the paywall). Wakey is an alarm you
 * can't just swipe off: you complete a real challenge to silence it, so you're
 * awake before it stops. The user should leave knowing exactly what they're
 * getting — then straight into the plan.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const WINS: { glyph: string; title: string; sub: string }[] = [
  { glyph: '✓', title: 'Earn your way out', sub: 'Solve, move, or scan to make it stop' },
  { glyph: '✓', title: 'No silent swipe', sub: 'You’re fully awake before it ends' },
  { glyph: '✓', title: 'Build the streak', sub: 'Every win makes tomorrow easier' },
];

export default function Solution() {
  return (
    <OnboardingShell
      progress={0.995}
      showBack
      eyebrow="MEET WAKEY"
      title="An alarm you have to earn your way out of."
      subtitle="No off button. To silence Wakey you complete a quick wake-up challenge — by the time it stops, you’re actually up."
      ctaLabel="I’m in"
      onCta={() => router.push('/paywall')}
    >
      <View style={styles.list}>
        {WINS.map((item, i) => (
          <Animated.View
            key={item.title}
            entering={FadeInDown.delay(140 + i * 100)
              .duration(440)
              .reduceMotion(ReduceMotion.System)}
            style={styles.row}
          >
            <View style={styles.glyphWrap}>
              <Text style={styles.glyph}>{item.glyph}</Text>
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>{item.sub}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OB.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 16,
  },
  glyphWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: OB.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  glyph: { fontFamily: OB.sansBold, fontSize: 17, color: OB.accentDeep },
  textWrap: { flex: 1 },
  rowTitle: { fontFamily: OB.sansSemi, fontSize: 15.5, color: OB.text },
  rowSub: { fontFamily: OB.sans, fontSize: 13, color: OB.textDim, marginTop: 2 },
});
