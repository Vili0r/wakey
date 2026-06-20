/**
 * Steps challenge — walk a number of real steps to dismiss.
 *
 * Counts actual walking via accelerometer peak-detection, incrementing the
 * counter the instant each step is taken.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Haptics } from '@/utils/alarm-store';
import { useStepCounter } from '@/hooks/use-step-counter';
import { type ChallengeProps, type ChallengeResult, targetFor } from '@/types/challenge';
import { Colors } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function StepsChallenge({
  difficulty,
  targetReps,
  onProgress,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps) * 5; // Steps are scaled up
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const [active, setActive] = useState(true);

  const { steps, source } = useStepCounter(active);
  const display = Math.min(steps, target);
  const lastHaptic = useRef(0);

  // React to step changes: progress, haptic feedback, and completion.
  useEffect(() => {
    if (done.current) return;
    onProgress?.(display, target);

    // Light tick on each new step.
    if (steps > lastHaptic.current && source !== 'pending') {
      lastHaptic.current = steps;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (steps >= target) {
      done.current = true;
      setActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const result: ChallengeResult = {
        completed: true,
        attempts: target,
        durationMs: Date.now() - startedAt.current,
      };
      onComplete(result);
    }
  }, [steps, display, target, source, onComplete, onProgress]);

  const statusLine =
    source === 'accelerometer'
      ? 'Walk with your phone to count steps'
      : 'Getting motion sensors ready…';

  return (
    <View style={styles.challengeContainer}>
      <Text style={styles.challengeTitle}>Walk it off</Text>
      <Text style={styles.challengeProgress}>
        {display} / {target} Steps Taken
      </Text>

      <View style={styles.iconContainer}>
        <Text style={styles.largeIcon}>👣</Text>
      </View>

      <Text style={styles.statusText}>{statusLine}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  challengeContainer: {
    width: width - 48,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  challengeTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    fontFamily: 'Sora_700Bold',
    textAlign: 'center',
  },
  challengeProgress: {
    fontSize: 15,
    color: Colors.dark.accent,
    fontFamily: 'Sora_600SemiBold',
    marginTop: 8,
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  largeIcon: {
    fontSize: 48,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Sora_500Medium',
    textAlign: 'center',
    marginBottom: 24,
  },
});
