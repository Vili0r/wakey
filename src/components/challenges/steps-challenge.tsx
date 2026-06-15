/**
 * Steps challenge — walk a certain number of steps to dismiss.
 * Conforms to the shared ChallengeProps contract.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Haptics } from '@/utils/alarm-store';
import { type ChallengeProps, type ChallengeResult, targetFor } from '@/types/challenge';
import { Colors } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function StepsChallenge({
  difficulty,
  targetReps,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps) * 5; // Steps are scaled up
  const [steps, setSteps] = useState(0);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const handleStep = () => {
    if (done.current) return;
    if (steps + 1 >= target) {
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const result: ChallengeResult = {
        completed: true,
        attempts: target,
        durationMs: Date.now() - startedAt.current,
      };
      onComplete(result);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSteps((s) => s + 1);
    }
  };

  return (
    <View style={styles.challengeContainer}>
      <Text style={styles.challengeTitle}>Walk it off</Text>
      <Text style={styles.challengeProgress}>
        {steps} / {target} Steps Taken
      </Text>

      <View style={styles.iconContainer}>
        <Text style={styles.largeIcon}>👣</Text>
      </View>

      <TouchableOpacity style={styles.actionButton} onPress={handleStep}>
        <Text style={styles.actionButtonText}>TAKE A STEP</Text>
      </TouchableOpacity>
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
    marginBottom: 32,
  },
  largeIcon: {
    fontSize: 48,
  },
  actionButton: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#1A1206',
    fontSize: 16,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 1.5,
  },
});
