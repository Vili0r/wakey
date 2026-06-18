/**
 * ChallengeIntro — the "what to do" overlay shown over the live camera before a
 * pose challenge starts. The camera is visible behind it so the user can frame
 * themselves and prop the phone, then taps "I'm ready" to begin counting reps.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export type ChallengeIntroProps = {
  title: string;
  steps: string[];
  /** e.g. "Complete 10 squats to turn off the alarm." */
  goal: string;
  onStart: () => void;
};

export default function ChallengeIntro({
  title,
  steps,
  goal,
  onStart,
}: ChallengeIntroProps) {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={styles.backdrop}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.steps}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.bullet}>
                <Text style={styles.bulletText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.goal}>{goal}</Text>

        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          hitSlop={6}
        >
          <Text style={styles.ctaText}>I’m ready</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,20,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 32,
    color: '#fff',
    marginBottom: 18,
  },
  steps: { gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletText: { fontFamily: 'Sora_600SemiBold', fontSize: 13, color: '#fff' },
  stepText: {
    flex: 1,
    fontFamily: 'Sora_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.92)',
  },
  goal: {
    fontFamily: 'Sora_500Medium',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 20,
  },
  cta: {
    marginTop: 22,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#111' },
});
