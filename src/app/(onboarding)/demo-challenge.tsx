/**
 * Screen 14 (climax) — a real, self-contained taste of the core loop. Tap the
 * rising suns to "earn" silence; a small target each time, haptics on hit, and
 * a satisfying finish. No real challenge engine here — it's a faithful minigame
 * so the user feels "earn your way out" before they ever pay.
 *
 * Always escapable (Skip) to honour the accessibility requirement that every
 * screen can be advanced.
 */

import { OB, OnboardingButton, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { Haptics } from '@/utils/alarm-store';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ReduceMotion,
  ZoomIn,
} from 'react-native-reanimated';

const TARGET = 4;
const SUN = 96;
const AREA_H = 380;

export default function DemoChallenge() {
  const [hits, setHits] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [keyN, setKeyN] = useState(0);
  const area = useRef({ w: 0, h: AREA_H });
  const done = hits >= TARGET;

  const reposition = useCallback(() => {
    const { w, h } = area.current;
    const maxX = Math.max(0, w - SUN);
    const maxY = Math.max(0, h - SUN);
    setPos({ x: Math.random() * maxX, y: Math.random() * maxY });
    setKeyN((k) => k + 1);
  }, []);

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (area.current.w === 0) {
      area.current = { w: width, h: height };
      reposition();
    }
  };

  const onHit = () => {
    if (done) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = hits + 1;
    setHits(next);
    if (next >= TARGET) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      reposition();
    }
  };

  return (
    <OnboardingShell
      progress={0.86}
      showBack
      eyebrow={done ? 'NICE' : `TAP TO WAKE · ${hits}/${TARGET}`}
      title={done ? 'You earned the silence.' : 'Tap the suns to silence it.'}
      ctaLabel={done ? 'That felt good →' : undefined}
      onCta={() => router.push('/streak')}
    >
      <View style={styles.area} onLayout={onAreaLayout}>
        {!done ? (
          <Pressable
            key={keyN}
            onPress={onHit}
            accessibilityRole="button"
            accessibilityLabel={`Tap the sun. ${hits} of ${TARGET}`}
            style={[styles.sunHit, { left: pos.x, top: pos.y }]}
          >
            <Animated.View
              entering={ZoomIn.duration(220).reduceMotion(ReduceMotion.System)}
            >
              <LinearGradient
                colors={OB.gradient}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.sun}
              >
                <Text style={styles.sunGlyph}>☀</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        ) : (
          <Animated.View
            entering={ZoomIn.duration(360).reduceMotion(ReduceMotion.System)}
            style={styles.doneWrap}
          >
            <LinearGradient colors={OB.gradient} style={styles.doneSun}>
              <Text style={styles.doneCheck}>✓</Text>
            </LinearGradient>
            <Text style={styles.doneText}>
              That’s the whole loop. Awake, on purpose — every morning.
            </Text>
          </Animated.View>
        )}
      </View>

      {!done && (
        <Animated.View entering={FadeIn.delay(400).reduceMotion(ReduceMotion.System)}>
          <Pressable
            onPress={() => router.push('/streak')}
            hitSlop={10}
            accessibilityRole="button"
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip the demo</Text>
          </Pressable>
        </Animated.View>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  area: {
    height: AREA_H,
    borderRadius: 24,
    backgroundColor: OB.surface,
    borderWidth: 1,
    borderColor: OB.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  sunHit: { position: 'absolute', width: SUN, height: SUN },
  sun: {
    width: SUN,
    height: SUN,
    borderRadius: SUN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OB.accentDeep,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  sunGlyph: { fontSize: 40, color: OB.onAccent },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  doneSun: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneCheck: { fontSize: 44, color: OB.onAccent, fontFamily: OB.sansBold },
  doneText: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
  },
  skip: { alignSelf: 'center', paddingVertical: 14, marginTop: 14 },
  skipText: { fontFamily: OB.sansMed, fontSize: 13.5, color: OB.textFaint, letterSpacing: 0.3 },
});
