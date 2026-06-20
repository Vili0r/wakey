/**
 * Screen 6 — pick the mission. This is what stands between the user and silence
 * every morning, so let them choose the one they can't fake half-asleep. The
 * choice seeds their first alarm's challenge (see onboarding/persistence).
 */

import { CHALLENGES } from '@/app/(tabs)/home/challenge';
import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { useOnboarding } from '@/onboarding/state';
import { Haptics } from '@/utils/alarm-store';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

// A curated slice of the full challenge set — brain, body, movement, proof.
const MISSION_IDS = ['math', 'find-item', 'pushups', 'squats', 'pattern', 'steps', 'photo', 'bed'] as const;
const MISSIONS = MISSION_IDS.map((id) => CHALLENGES.find((c) => c.id === id)!);

export default function QMission() {
  const { state, update } = useOnboarding();

  return (
    <OnboardingShell
      progress={0.32}
      showBack
      eyebrow="YOUR MISSION"
      title="Choose your challenge?"
      subtitle="Wakey won’t go quiet until you finish this. Pick the one you can’t fake half-asleep."
      ctaLabel="Continue"
      onCta={() => router.push('/alarm-contrast')}
    >
      <View>
        {MISSIONS.map((m, i) => {
          const selected = state.mission === m.id;
          return (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(80 + i * 60)
                .duration(420)
                .reduceMotion(ReduceMotion.System)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${m.name}. ${m.desc}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  update({ mission: m.id });
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: selected ? OB.accentSoft : OB.surface,
                    borderColor: selected ? OB.accent : OB.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={styles.glyphWrap}>
                  <Text style={styles.glyph}>{m.glyph}</Text>
                </View>
                <View style={styles.textWrap}>
                  <Text style={[styles.name, { color: selected ? OB.accentText : OB.text }]}>
                    {m.name}
                  </Text>
                  <Text style={styles.desc}>{m.desc}</Text>
                </View>
                <View
                  style={[
                    styles.check,
                    {
                      borderColor: selected ? OB.accent : OB.border,
                      backgroundColor: selected ? OB.accent : 'transparent',
                    },
                  ]}
                >
                  {selected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  glyphWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OB.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  glyph: { fontFamily: OB.sansSemi, fontSize: 19, color: OB.accentDeep },
  textWrap: { flex: 1, paddingRight: 12 },
  name: { fontFamily: OB.sansSemi, fontSize: 16, letterSpacing: 0.1 },
  desc: { fontFamily: OB.sans, fontSize: 13, color: OB.textDim, marginTop: 3 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: OB.onAccent, fontSize: 13, fontFamily: OB.sansBold },
});
