/**
 * Frame the problem (pre-paywall). Mornings are winnable; the usual tools are
 * what lose. Naming the real enemy (snooze, willpower, a swipeable phone) sets
 * up Wakey as the obvious fix on the next screen.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const LOSERS: { glyph: string; title: string; sub: string }[] = [
  { glyph: '☓', title: 'A swipeable alarm', sub: 'Off before you’re even awake' },
  { glyph: '☓', title: 'Just one more snooze', sub: 'Nine minutes that cost you the morning' },
  { glyph: '☓', title: 'Raw willpower', sub: 'Your half-asleep brain always wins' },
  { glyph: '☓', title: 'A pile of backup alarms', sub: 'You’ve learned to sleep through them' },
];

export default function Problem() {
  return (
    <OnboardingShell
      progress={0.99}
      showBack
      eyebrow="LET’S BE HONEST"
      title="It’s not you. It’s the tools."
      subtitle="Waking up is a solvable problem. These are the things quietly losing it for you every morning."
      ctaLabel="So what works?"
      onCta={() => router.push('/solution')}
    >
      <View style={styles.list}>
        {LOSERS.map((item, i) => (
          <Animated.View
            key={item.title}
            entering={FadeInDown.delay(120 + i * 90)
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
  glyph: { fontFamily: OB.sansSemi, fontSize: 18, color: OB.accentDeep },
  textWrap: { flex: 1 },
  rowTitle: { fontFamily: OB.sansSemi, fontSize: 15.5, color: OB.text },
  rowSub: { fontFamily: OB.sans, fontSize: 13, color: OB.textDim, marginTop: 2 },
});
