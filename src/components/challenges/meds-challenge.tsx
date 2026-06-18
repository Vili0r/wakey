import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type ChallengeProps, type ChallengeResult } from '@/types/challenge';
import { Haptics } from '@/utils/alarm-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import ChallengeIntro from './challenge-intro';

const DEFAULT_MEDS = [
  { id: 'dose', label: 'Take Morning Dose' },
  { id: 'vitamin', label: 'Take Vitamins/Supplements' },
  { id: 'water', label: 'Drink Glass of Water' },
];

export default function MedsChallenge({
  onComplete,
  onAbort,
}: ChallengeProps) {
  const isDark = useColorScheme() !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const [started, setStarted] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState(false);

  const startedAt = useRef(0);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const [isPressing, setIsPressing] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStart = useCallback(() => {
    setStarted(true);
    startedAt.current = Date.now();
  }, []);

  const toggleItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const allChecked = DEFAULT_MEDS.every((med) => checkedItems[med.id]);

  const handlePressIn = () => {
    if (!allChecked || success) return;
    setIsPressing(true);

    // Animate progress to 1 (fill bar) over 1200ms
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    // Trigger success after 1200ms
    holdTimerRef.current = setTimeout(() => {
      handleConfirm();
    }, 1200);
  };

  const handlePressOut = () => {
    if (success) return;
    setIsPressing(false);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Reset progress animation quickly (200ms)
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleConfirm = () => {
    setSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      onComplete({
        completed: true,
        attempts: 1,
        durationMs: Date.now() - startedAt.current,
      });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Map progress to width percentage
  const widthInterpolate = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {started ? (
        <View style={styles.container}>
          <Text style={[styles.title, { color: theme.text }]}>Medication Check</Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>
            Ensure you take your doses before silencing.
          </Text>

          {/* Checklist */}
          <View style={styles.checklist}>
            {DEFAULT_MEDS.map((med) => {
              const isChecked = !!checkedItems[med.id];
              return (
                <Pressable
                  key={med.id}
                  onPress={() => toggleItem(med.id)}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isChecked ? theme.accent : theme.surfaceBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isChecked ? theme.accent : theme.textFaint,
                        backgroundColor: isChecked ? theme.accent : 'transparent',
                      },
                    ]}
                  >
                    {isChecked && <Text style={styles.checkIcon}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.itemLabel,
                      {
                        color: theme.text,
                        textDecorationLine: isChecked ? 'line-through' : 'none',
                        opacity: isChecked ? 0.6 : 1,
                      },
                    ]}
                  >
                    {med.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Hold to Confirm Button */}
          <View style={styles.buttonContainer}>
            {allChecked ? (
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={({ pressed }) => [
                  styles.holdButton,
                  { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                  pressed && styles.holdButtonPressed,
                ]}
              >
                {/* Progress fill bar */}
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: widthInterpolate,
                      backgroundColor: theme.accent,
                    },
                  ]}
                />
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  {success
                    ? 'Confirmed!'
                    : isPressing
                    ? 'Hold tight…'
                    : 'Press & Hold to Confirm'}
                </Text>
              </Pressable>
            ) : (
              <View style={[styles.holdButtonDisabled, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <Text style={[styles.buttonTextDisabled, { color: theme.textFaint }]}>
                  Complete list to unlock
                </Text>
              </View>
            )}
          </View>

          {/* Fallback Abort button */}
          {onAbort && (
            <Pressable onPress={onAbort} style={styles.abortButton}>
              <Text style={[styles.abortText, { color: theme.textFaint }]}>I can’t do this</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ChallengeIntro
          title="Medication routine"
          steps={[
            'Go to where you keep your doses.',
            'Prepare a glass of water.',
            'Take your doses and check off the checklist.',
          ]}
          goal="Check off your daily checklist to turn off the alarm."
          onStart={handleStart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  checklist: {
    width: '100%',
    gap: 12,
    marginBottom: 40,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
  },
  itemLabel: {
    flex: 1,
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
  },
  buttonContainer: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  holdButton: {
    flex: 1,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  holdButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  holdButtonDisabled: {
    flex: 1,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  buttonText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
    zIndex: 1,
  },
  buttonTextDisabled: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  abortButton: {
    marginTop: 24,
    padding: 8,
  },
  abortText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
