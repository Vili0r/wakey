/**
 * Screen 14 (climax) — a real, self-contained taste of the core loop. This is
 * the Pattern Recall mission: the grid plays a short sequence, then the user
 * taps it back to "earn" silence. Same mechanic as the live alarm challenge,
 * restyled for the light onboarding shell and tuned short + forgiving for a demo.
 *
 * Always escapable (Skip) to honour the accessibility requirement that every
 * screen can be advanced.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { Haptics } from '@/utils/alarm-store';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, ZoomIn } from 'react-native-reanimated';

const GRID = 9;
const SEQ_LEN = 5; // sweet spot — a real test of memory, still beatable
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const makeSequence = () =>
  Array.from({ length: SEQ_LEN }, () => Math.floor(Math.random() * GRID));

export default function DemoChallenge() {
  const [sequence] = useState(makeSequence);
  const [phase, setPhase] = useState<'watch' | 'input'>('watch');
  const [active, setActive] = useState<number | null>(null);
  const [input, setInput] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const runRef = useRef(0);

  // Play the sequence, then hand control to the user. A run id invalidates any
  // in-flight playback (unmount, or a replay after a wrong tap).
  const playSequence = useCallback(async () => {
    const run = ++runRef.current;
    setInput([]);
    setActive(null);
    setPhase('watch');
    await wait(500);
    for (const cell of sequence) {
      if (runRef.current !== run) return;
      setActive(cell);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await wait(420);
      if (runRef.current !== run) return;
      setActive(null);
      await wait(180);
    }
    if (runRef.current !== run) return;
    setPhase('input');
  }, [sequence]);

  useEffect(() => {
    playSequence();
    return () => {
      runRef.current++;
    };
  }, [playSequence]);

  const handlePress = useCallback(
    (i: number) => {
      if (phase !== 'input' || done) return;
      if (i !== sequence[input.length]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setWrong(i);
        setTimeout(() => {
          setWrong(null);
          playSequence();
        }, 650);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = [...input, i];
      setInput(next);
      if (next.length === sequence.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setDone(true);
      }
    },
    [phase, done, sequence, input, playSequence],
  );

  const eyebrow = done
    ? 'NICE'
    : phase === 'watch'
      ? 'WATCH THE PATTERN'
      : `YOUR TURN · ${input.length}/${sequence.length}`;
  const title = done
    ? 'You earned the silence.'
    : phase === 'watch'
      ? 'Memorise the sequence.'
      : 'Now tap it back.';

  return (
    <OnboardingShell
      progress={0.86}
      showBack
      eyebrow={eyebrow}
      title={title}
      ctaLabel={done ? 'That felt good →' : undefined}
      onCta={() => router.push('/streak')}
    >
      {!done ? (
        <View style={styles.area}>
          <View style={styles.grid}>
            {Array.from({ length: GRID }).map((_, i) => {
              const lit = active === i || (phase === 'input' && input.includes(i));
              const isWrong = wrong === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => handlePress(i)}
                  disabled={phase !== 'input'}
                  accessibilityRole="button"
                  accessibilityLabel={`Pattern tile ${i + 1}`}
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  {lit && !isWrong ? (
                    <LinearGradient
                      colors={OB.gradient}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 1 }}
                      style={[styles.tile, styles.tileLit]}
                    />
                  ) : (
                    <View style={[styles.tile, isWrong && styles.tileWrong]} />
                  )}
                </Pressable>
              );
            })}
          </View>

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
        </View>
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
    </OnboardingShell>
  );
}

const TILE = 92;

const styles = StyleSheet.create({
  area: { alignItems: 'center', marginTop: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: TILE * 3 + 28,
    gap: 14,
    marginTop: 42,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 20,
    backgroundColor: OB.surface,
    borderWidth: 1.5,
    borderColor: OB.border,
  },
  tileLit: {
    borderWidth: 0,
    shadowColor: OB.accentDeep,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  tileWrong: { borderColor: '#D9534F', backgroundColor: 'rgba(217,83,79,0.08)' },
  skip: { alignSelf: 'center', paddingVertical: 14, marginTop: 22 },
  skipText: { fontFamily: OB.sansMed, fontSize: 13.5, color: OB.textFaint, letterSpacing: 0.3 },
  doneWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
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
    paddingHorizontal: 24,
  },
});
