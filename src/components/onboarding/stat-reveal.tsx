/**
 * stat-reveal — the personalized "this lands" moment. A huge serif numeral
 * animates up, with a unit and a supporting line, so a derived statistic feels
 * like a gut-punch rather than a footnote. Presentational only; the screen
 * computes the figure and supplies the copy.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

export function StatReveal({
  value,
  unit,
  lead,
  children,
}: {
  /** The big number, e.g. "91". */
  value: string;
  /** Small-caps unit under the number, e.g. "GROGGY HOURS A YEAR". */
  unit: string;
  /** Optional line above the number. */
  lead?: string;
  /** Supporting copy below. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {lead && (
        <Animated.Text
          entering={FadeInDown.duration(420).reduceMotion(ReduceMotion.System)}
          style={styles.lead}
        >
          {lead}
        </Animated.Text>
      )}
      <Animated.Text
        entering={FadeInDown.delay(140)
          .duration(620)
          .springify()
          .damping(20)
          .reduceMotion(ReduceMotion.System)}
        style={styles.value}
      >
        {value}
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.delay(360).duration(500).reduceMotion(ReduceMotion.System)}
        style={styles.unit}
      >
        {unit}
      </Animated.Text>
      {children && (
        <Animated.View
          entering={FadeInDown.delay(520)
            .duration(520)
            .reduceMotion(ReduceMotion.System)}
          style={styles.body}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 12 },
  lead: {
    fontFamily: OB.sansMed,
    fontSize: 16,
    color: OB.textDim,
    textAlign: 'center',
    marginBottom: 4,
  },
  value: {
    fontFamily: OB.serif,
    fontSize: 132,
    lineHeight: 138,
    letterSpacing: -3,
    color: OB.accentDeep,
  },
  unit: {
    fontFamily: OB.mono,
    fontSize: 12,
    letterSpacing: 2.6,
    color: OB.accentText,
    marginTop: 4,
    textAlign: 'center',
  },
  body: { marginTop: 24, paddingHorizontal: 8 },
});
