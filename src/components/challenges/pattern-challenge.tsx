/**
 * Pattern recall challenge — remember and repeat a sequence.
 * Conforms to the shared ChallengeProps contract.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export default function PatternChallenge({
  difficulty,
  targetReps,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps);
  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const playSequence = useCallback(async (seq: number[]) => {
    setPlaying(true);
    for (let i = 0; i < seq.length; i++) {
      setActiveButton(seq[i]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setActiveButton(null);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    setPlaying(false);
  }, []);

  const startRound = useCallback(
    (r: number) => {
      setUserInput([]);
      const seqLength = r + 2;
      const seq = Array.from({ length: seqLength }, () =>
        Math.floor(Math.random() * 9),
      );
      setSequence(seq);
      playSequence(seq);
    },
    [playSequence],
  );

  useEffect(() => {
    startRound(round);
  }, [round, startRound]);

  const handlePress = useCallback(
    (index: number) => {
      if (playing || done.current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextInput = [...userInput, index];
      setUserInput(nextInput);

      const expected = sequence[nextInput.length - 1];
      if (index !== expected) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAttempts((a) => a + 1);
        setRound(1);
        return;
      }

      if (nextInput.length === sequence.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (round >= target) {
          done.current = true;
          const result: ChallengeResult = {
            completed: true,
            attempts: attempts + 1,
            durationMs: Date.now() - startedAt.current,
          };
          onComplete(result);
        } else {
          setRound((r) => r + 1);
        }
      }
    },
    [playing, userInput, sequence, round, target, attempts, onComplete],
  );

  return (
    <View style={styles.challengeContainer}>
      <Text style={styles.challengeTitle}>
        Recall Pattern (Round {round}/{target})
      </Text>
      <Text style={styles.challengeProgress}>
        {playing ? 'Watch sequence...' : 'Repeat sequence!'}
      </Text>

      <View style={styles.gridContainer}>
        {Array.from({ length: 9 }).map((_, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.8}
            style={[
              styles.gridButton,
              activeButton === i && styles.gridButtonActive,
            ]}
            onPress={() => handlePress(i)}
            disabled={playing}
          />
        ))}
      </View>
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 240,
    gap: 12,
    marginBottom: 16,
  },
  gridButton: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridButtonActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
    shadowColor: Colors.dark.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
});
