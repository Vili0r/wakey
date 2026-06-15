/**
 * Shake challenge — tap to simulate shakes until target reached.
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Haptics } from '@/utils/alarm-store';
import { type ChallengeProps, type ChallengeResult, targetFor } from '@/types/challenge';
import { Colors } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function ShakeChallenge({
  difficulty,
  targetReps,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps);
  // Scale up for shakes — they're easy
  const shakeTarget = target * 7;
  const [count, setCount] = useState(0);
  const rotation = useSharedValue(0);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const triggerShakeAnimation = () => {
    rotation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const handleShake = () => {
    if (done.current) return;
    if (count + 1 >= shakeTarget) {
      done.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const result: ChallengeResult = {
        completed: true,
        attempts: shakeTarget,
        durationMs: Date.now() - startedAt.current,
      };
      onComplete(result);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCount((c) => c + 1);
      triggerShakeAnimation();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.challengeContainer}>
      <Text style={styles.challengeTitle}>Shake Device</Text>
      <Text style={styles.challengeProgress}>
        {count} / {shakeTarget} Shakes
      </Text>

      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        <Text style={styles.largeIcon}>📱</Text>
      </Animated.View>

      <TouchableOpacity style={styles.actionButton} onPress={handleShake}>
        <Text style={styles.actionButtonText}>SHAKE</Text>
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
