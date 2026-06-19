/**
 * Screen 18 (commitment) — instead of a signature or a held finger, Wakey asks
 * for its own ritual: drag the sun up across the horizon to "raise" your first
 * morning. The pledge fills in line by line as it rises, haptics tick at each
 * stage, and it only locks when the sun clears the top — you can't half-commit.
 *
 * Accessibility: dragging isn't reachable for every user, so a plain
 * "commit" button completes the same action, and reduce-motion is respected.
 */

import { OB, OnboardingButton, ProgressBar } from '@/components/onboarding/onboarding-shell';
import { Haptics } from '@/utils/alarm-store';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const TRACK_H = 360;
const SUN = 84;
const MAX_UP = TRACK_H - SUN - 24; // travel distance from bottom to top

const PLEDGE = [
  'I’m done sleeping through my mornings.',
  'When Wakey rings, I get up.',
  'Feet on the floor. Every day.',
];

export default function Commitment() {
  const insets = useSafeAreaInsets();
  const [committed, setCommitted] = useState(false);
  const ty = useSharedValue(0); // 0 = bottom, -MAX_UP = top
  const lastNotch = useSharedValue(0);

  const onLock = useCallback(() => {
    setCommitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const tick = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const completeViaButton = useCallback(() => {
    ty.value = withSpring(-MAX_UP, { damping: 18, stiffness: 160 });
    onLock();
  }, [onLock, ty]);

  const pan = Gesture.Pan()
    .enabled(!committed)
    .onStart(() => {
      lastNotch.value = Math.floor((-ty.value / MAX_UP) * 3);
    })
    .onUpdate((e) => {
      const next = Math.min(0, Math.max(-MAX_UP, e.translationY));
      ty.value = next;
      const notch = Math.floor((-next / MAX_UP) * 3);
      if (notch !== lastNotch.value && notch > 0) {
        lastNotch.value = notch;
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      const progress = -ty.value / MAX_UP;
      if (progress >= 0.97) {
        ty.value = withSpring(-MAX_UP, { damping: 18, stiffness: 160 });
        runOnJS(onLock)();
      } else {
        ty.value = withSpring(0, { damping: 20, stiffness: 180 });
      }
    });

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  const trailStyle = useAnimatedStyle(() => ({
    height: -ty.value + SUN / 2,
    opacity: interpolate(-ty.value, [0, MAX_UP], [0.15, 0.6], Extrapolation.CLAMP),
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-ty.value, [0, 40], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={12}
          accessibilityLabel="Go back"
          style={[styles.backBtn, styles.backBtnActive]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M15 19L8 12L15 5"
              stroke={OB.text}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
        <ProgressBar progress={0.97} />
        <View style={styles.backBtn} />
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR PLEDGE</Text>
        <Text style={styles.title}>Raise your first sun.</Text>
        <Text style={styles.subtitle}>
          Drag the sun up and over the horizon to commit. Take it all the way.
        </Text>
      </View>

      <View style={styles.pledge}>
        {PLEDGE.map((line, i) => (
          <PledgeLine key={i} text={line} index={i} ty={ty} />
        ))}
      </View>

      <View style={styles.track}>
        <View style={styles.horizon} />
        <Animated.View style={[styles.trail, trailStyle]}>
          <LinearGradient
            colors={['transparent', OB.accentSoft]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.sunWrap, sunStyle]}
            accessibilityRole="adjustable"
            accessibilityLabel="Raise the sun to commit"
          >
            <LinearGradient
              colors={OB.gradient}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.sun}
            >
              <Text style={styles.sunGlyph}>{committed ? '✓' : '☀'}</Text>
            </LinearGradient>
          </Animated.View>
        </GestureDetector>

        <Animated.Text style={[styles.dragHint, hintStyle]}>drag up to ↑</Animated.Text>
      </View>

      <View style={styles.footer}>
        {committed ? (
          <OnboardingButton label="I’m committed" onPress={() => router.push('/social-proof')} />
        ) : (
          <Pressable onPress={completeViaButton} hitSlop={8} style={styles.altBtn}>
            <Text style={styles.altText}>Lock in my commitment</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** One pledge line that fades + lifts in as the sun passes its threshold. */
function PledgeLine({
  text,
  index,
  ty,
}: {
  text: string;
  index: number;
  ty: SharedValue<number>;
}) {
  const threshold = ((index + 1) / 3) * MAX_UP;
  const style = useAnimatedStyle(() => {
    const reached = -ty.value;
    return {
      opacity: interpolate(reached, [threshold - MAX_UP / 3, threshold], [0.18, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(reached, [threshold - MAX_UP / 3, threshold], [6, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });
  return <Animated.Text style={[styles.pledgeLine, style]}>{text}</Animated.Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OB.bg, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 40 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backBtnActive: {
    backgroundColor: OB.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OB.border,
  },
  header: { marginTop: 18 },
  eyebrow: { fontFamily: OB.mono, fontSize: 11, letterSpacing: 2.4, color: OB.accentText, marginBottom: 10 },
  title: { fontFamily: OB.serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.5, color: OB.text },
  subtitle: { fontFamily: OB.sans, fontSize: 15, lineHeight: 22, color: OB.textDim, marginTop: 10 },
  pledge: { marginTop: 18, gap: 6 },
  pledgeLine: { fontFamily: OB.sansSemi, fontSize: 16, color: OB.text },
  track: {
    flex: 1,
    minHeight: TRACK_H,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  horizon: {
    position: 'absolute',
    bottom: SUN / 2 + 10,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: OB.border,
  },
  trail: {
    position: 'absolute',
    bottom: 24,
    width: SUN,
    borderRadius: SUN,
    overflow: 'hidden',
  },
  sunWrap: { position: 'absolute', bottom: 24 },
  sun: {
    width: SUN,
    height: SUN,
    borderRadius: SUN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OB.accentDeep,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  sunGlyph: { fontSize: 36, color: OB.onAccent },
  dragHint: {
    position: 'absolute',
    bottom: SUN + 40,
    fontFamily: OB.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: OB.textFaint,
  },
  footer: { paddingTop: 8, minHeight: 70, justifyContent: 'center' },
  altBtn: { alignSelf: 'center', paddingVertical: 14 },
  altText: { fontFamily: OB.mono, fontSize: 15, color: OB.textFaint, letterSpacing: 0.3 },
});
