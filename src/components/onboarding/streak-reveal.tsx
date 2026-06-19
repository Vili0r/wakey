/**
 * streak-reveal — the gamification payoff. A glowing sunrise disc with a big
 * serif streak numeral, used at the emotional peak (Day 1) of onboarding. The
 * glow breathes unless reduce-motion is on. Presentational only.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function StreakReveal({
  count,
  label = 'DAY STREAK',
}: {
  count: number;
  label?: string;
}) {
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + breath.value * 0.4,
    transform: [{ scale: 0.92 + breath.value * 0.16 }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.discWrap}>
        <Animated.View style={[styles.glow, glowStyle]}>
          <LinearGradient
            colors={[OB.accent, OB.accentDeep]}
            style={styles.glowFill}
          />
        </Animated.View>
        <Animated.View
          entering={FadeIn.duration(600).reduceMotion(ReduceMotion.System)}
        >
          <LinearGradient
            colors={OB.gradient}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.disc}
          >
            <Text style={styles.count}>{count}</Text>
          </LinearGradient>
        </Animated.View>
      </View>
      <Animated.Text
        entering={FadeInDown.delay(220).duration(480).reduceMotion(ReduceMotion.System)}
        style={styles.label}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  discWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 200, height: 200 },
  glowFill: { flex: 1, borderRadius: 100, opacity: 0.35 },
  disc: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontFamily: OB.serif,
    fontSize: 92,
    lineHeight: 96,
    color: OB.onAccent,
  },
  label: {
    fontFamily: OB.mono,
    fontSize: 12,
    letterSpacing: 3,
    color: OB.accentText,
    marginTop: 14,
  },
});
