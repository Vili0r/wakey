/**
 * Screen 7 — a short "analyzing your answers" beat. It does no real work; the
 * pause makes the personalized stat that follows feel earned. Auto-advances,
 * and uses router.replace so Back skips straight past it.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const LINES = [
  'Reading your morning habits…',
  'Counting the snooze cost…',
  'Mapping your wake-up plan…',
];

export default function Analyzing() {
  const spin = useSharedValue(0);
  const [line, setLine] = useState(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [spin]);

  useEffect(() => {
    const ticker = setInterval(() => setLine((l) => Math.min(l + 1, LINES.length - 1)), 800);
    let cancelled = false;
    // Respect reduce-motion by shortening the wait, but always advance.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => (reduce ? 900 : 2500))
      .catch(() => 2500)
      .then((delay) => {
        setTimeout(() => {
          if (!cancelled) router.replace('/reveal-stat');
        }, delay);
      });
    return () => {
      cancelled = true;
      clearInterval(ticker);
    };
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <OnboardingShell progress={0.42} center>
      <View style={styles.wrap}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.Text
          key={line}
          entering={FadeIn.duration(360).reduceMotion(ReduceMotion.System)}
          style={styles.line}
        >
          {LINES[line]}
        </Animated.Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 28 },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: OB.accentSoft,
    borderTopColor: OB.accentDeep,
  },
  line: { fontFamily: OB.sansMed, fontSize: 16, color: OB.textDim, textAlign: 'center' },
});
