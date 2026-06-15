/**
 * Math challenge — solve N equations to dismiss.
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

export default function MathChallenge({
  difficulty,
  targetReps,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps);
  const [question, setQuestion] = useState({ q: '', ans: 0, options: [] as number[] });
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const generateQuestion = useCallback(() => {
    const a = Math.floor(Math.random() * 12) + 3;
    const b = Math.floor(Math.random() * 12) + 3;
    const isPlus = Math.random() > 0.5;
    const q = isPlus ? `${a} + ${b}` : `${a + b} - ${b}`;
    const ans = isPlus ? a + b : a;

    const options = [ans];
    while (options.length < 3) {
      const offset = Math.floor(Math.random() * 6) - 3;
      const opt = ans + offset;
      if (opt !== ans && opt > 0 && !options.includes(opt)) {
        options.push(opt);
      }
    }
    options.sort(() => Math.random() - 0.5);
    setQuestion({ q, ans, options });
  }, []);

  useEffect(() => {
    generateQuestion();
  }, [solved, generateQuestion]);

  const handleSelect = useCallback(
    (selected: number) => {
      if (done.current) return;
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (selected === question.ans) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (solved + 1 >= target) {
          done.current = true;
          const result: ChallengeResult = {
            completed: true,
            attempts: nextAttempts,
            durationMs: Date.now() - startedAt.current,
          };
          onComplete(result);
        } else {
          setSolved((s) => s + 1);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        generateQuestion();
      }
    },
    [attempts, question.ans, solved, target, onComplete, generateQuestion],
  );

  return (
    <View style={styles.challengeContainer}>
      <Text style={styles.challengeTitle}>Solve {target} Equations</Text>
      <Text style={styles.challengeProgress}>
        {solved} / {target} Beaten
      </Text>

      <View style={styles.mathCard}>
        <Text style={styles.mathText}>{question.q} = ?</Text>
      </View>

      <View style={styles.optionsContainer}>
        {question.options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={styles.optionButton}
            onPress={() => handleSelect(opt)}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </TouchableOpacity>
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
  mathCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  mathText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'SpaceMono_400Regular',
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Sora_600SemiBold',
  },
});
