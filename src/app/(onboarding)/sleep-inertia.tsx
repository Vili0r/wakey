/**
 * Screen 10 — reframe the struggle as biology, not a character flaw. The
 * cortisol awakening response (a real ~50% post-waking cortisol surge) takes the
 * blame off the user right after they've admitted the hardest part of their
 * morning, and sets up Wakey as the way to ride that boost instead of sleeping
 * through it. The SVG plots that surge: flat while asleep, a sharp peak on
 * waking, then a gentle decline.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

// The cortisol-awakening curve. `CURVE` is the stroke; `AREA` closes it to the
// baseline for the soft fill underneath.
const CURVE =
  'M8 96 C40 94 56 92 70 84 C88 74 96 30 112 26 C134 20 156 52 180 62 C196 68 206 70 212 72';
const AREA = `${CURVE} L212 104 L8 104 Z`;
const PEAK = { x: 112, y: 26 };

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
        <Animated.View
          entering={FadeIn.duration(600).reduceMotion(ReduceMotion.System)}
          style={styles.chart}
        >
          <Svg width={232} height={124} viewBox="0 0 220 116">
            <Defs>
              <LinearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={OB.accent} />
                <Stop offset="1" stopColor={OB.accentDeep} />
              </LinearGradient>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={OB.accent} stopOpacity={0.22} />
                <Stop offset="1" stopColor={OB.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* baseline */}
            <Line x1={8} y1={104} x2={212} y2={104} stroke={OB.border} strokeWidth={1.5} />

            {/* "you wake" marker under the rise */}
            <Line
              x1={78}
              y1={20}
              x2={78}
              y2={104}
              stroke={OB.accentSoft}
              strokeWidth={2}
              strokeDasharray="2 5"
            />

            <Path d={AREA} fill="url(#fill)" />
            <Path
              d={CURVE}
              fill="none"
              stroke="url(#stroke)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* peak of the surge */}
            <Circle cx={PEAK.x} cy={PEAK.y} r={7} fill={OB.accentDeep} />
            <Circle cx={PEAK.x} cy={PEAK.y} r={3} fill={OB.onAccent} />
          </Svg>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(280).duration(480).reduceMotion(ReduceMotion.System)}
          style={styles.subtitle}
        >
          In the first minutes after you wake, your body releases a natural surge
          of cortisol — alertness chemistry that peaks about 50% higher to get you
          moving. Snooze through it and you waste the one boost biology hands you
          for free.
        </Animated.Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  chart: { marginBottom: 32 },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 16,
  },
});
