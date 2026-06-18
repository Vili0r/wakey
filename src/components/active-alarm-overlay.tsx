/**
 * ActiveAlarmOverlay — the gate.
 *
 * Core rule of the app: the alarm cannot be silenced until the challenge is
 * completed. This component enforces that *in-app*:
 *   - Full-screen Modal that cannot be dismissed (no close button, back blocked).
 *   - The ONLY success exit is the challenge's onComplete.
 *   - Re-asserts itself when the app returns to the foreground.
 *   - Persists a "pending alarm" flag so killing/relaunching the app doesn't bypass it.
 *
 * IMPORTANT (OS reality): you cannot remove the system Stop button on an iOS
 * AlarmKit alarm or a notification. Treat the system alarm as a WAKE that
 * launches the app and presents this overlay; do the actual sound-stop here,
 * only on success. Keep the pending flag authoritative.
 */

import { THEMES } from '@/constants/theme';
import { db } from '@/db/db';
import { streakState } from '@/db/schema';
import type { ChallengeResult } from '@/types/challenge';
import { useActiveAlarm, type ActiveAlarm } from '@/utils/active-alarm-store';
import { startAlarmNag, stopAlarmNag } from '@/utils/alarm-nag';
import { startAlarmSound } from '@/utils/alarm-sound';
import { clearAlarmPending, markAlarmPending, resolveAlarmAndRecord, stopAlarm } from '@/utils/alarm-store';
import { eq } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Modal, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import FindItemChallenge from './challenges/find-item-challenge';
import MathChallenge from './challenges/math-challenge';
import PatternChallenge from './challenges/pattern-challenge';
import PushupsChallenge from './challenges/pushups-challenge';
import ShakeChallenge from './challenges/shake-challenge';
import SquatsChallenge from './challenges/squats-challenge';
import StepsChallenge from './challenges/steps-challenge';

export type { ActiveAlarm };

const getChallengeGlyph = (challengeId: string) => {
  const mapping = {
    math: '÷',
    shake: '≈',
    pattern: '◫',
    steps: '∴',
    pushups: '⤓',
    squats: '⇕',
    photo: '◎',
    scan: '⊡',
    'find-item': '⊡',
    bed: '▭',
    meds: '✚',
  };
  return mapping[challengeId as keyof typeof mapping] || '÷';
};

const getChallengeName = (challengeId: string) => {
  const mapping = {
    math: 'Equations',
    shake: 'Shake',
    pattern: 'Pattern Recall',
    steps: 'Steps',
    pushups: 'Push-ups',
    squats: 'Squats',
    photo: 'Sky Photo',
    scan: 'Code Hunt',
    'find-item': 'Find Item',
    bed: 'Make Bed',
    meds: 'Medication',
  };
  return mapping[challengeId as keyof typeof mapping] || 'Equations';
};

export default function ActiveAlarmOverlay({
  onCompleted,
  onGaveUp,
  allowGiveUp = false,
}: {
  /** Called only on successful challenge completion. Caller logs alarm_events + streaks. */
  onCompleted: (alarm: ActiveAlarm, result: ChallengeResult) => void;
  /** Called if you allow a gated escape. Logged as NOT completed. */
  onGaveUp?: (alarm: ActiveAlarm) => void;
  /** Product switch: keep an accessibility escape, or make it absolute. */
  allowGiveUp?: boolean;
}) {
  const alarm = useActiveAlarm();
  const visible = alarm !== null;
  const completedRef = useRef(false);
  const firedAtRef = useRef<Date>(new Date());
  const challengeResultRef = useRef<ChallengeResult | null>(null);

  const [flowState, setFlowState] = useState<'intro' | 'challenge' | 'completed'>('intro');
  const [streakInfo, setStreakInfo] = useState<{ currentStreak: number; totalBeaten: number } | null>(null);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? THEMES.dark : THEMES.light;

  // Persist a pending flag so a kill/relaunch can't bypass the gate.
  useEffect(() => {
    if (alarm) {
      completedRef.current = false;
      firedAtRef.current = new Date();
      challengeResultRef.current = null;
      markAlarmPending(alarm);
      // Start the un-silenceable in-app alarm. The system AlarmKit alarm was
      // only a wake/launch trigger; THIS is what the challenge must silence.
      startAlarmSound(alarm.soundId);
      // Also arm the native nag: if the user tries to escape by backgrounding
      // the app, re-fire the system AlarmKit alarm (tone + Live Activity) on a
      // 10s cycle until the challenge is done. No-op while foregrounded.
      startAlarmNag({ title: getChallengeName(alarm.challenge) });

      const timer = setTimeout(() => {
        setFlowState('intro');
        setStreakInfo(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [alarm]);

  // Block the Android hardware back button while the gate is up and unmet.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true); // swallow
    return () => sub.remove();
  }, [visible]);

  // If the app is foregrounded while an alarm is still pending, the Modal is
  // already mounted (state-driven), so it simply stays up. Re-assert the alarm
  // sound here in case the OS paused it.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && alarm && !completedRef.current) {
        // Re-assert the sound on resume. startAlarmSound is idempotent, so this
        // is a no-op if the audio survived backgrounding.
        startAlarmSound(alarm.soundId);
      }
    });
    return () => sub.remove();
  }, [visible, alarm]);

  const handleComplete = useCallback(
    async (result: ChallengeResult) => {
      if (!alarm || completedRef.current) return;
      completedRef.current = true;
      stopAlarm(alarm.alarmId); // the ONLY place the alarm is silenced
      stopAlarmNag(); // tear down the native re-fire loop
      clearAlarmPending();

      try {
        await resolveAlarmAndRecord({
          alarmId: alarm.alarmId,
          challenge: alarm.challenge as any,
          difficulty: alarm.difficulty as any,
          firedAt: firedAtRef.current,
          outcome: 'dismissed',
          attempts: result.attempts,
          snoozeCount: 0,
        });

        // Query the updated streak state from the database
        const rows = await db.select().from(streakState).where(eq(streakState.id, 1));
        if (rows.length > 0) {
          setStreakInfo({
            currentStreak: rows[0].currentStreak,
            totalBeaten: rows[0].totalBeaten,
          });
        } else {
          setStreakInfo({ currentStreak: 1, totalBeaten: 1 });
        }
      } catch (err) {
        console.error('Error resolving alarm in overlay:', err);
      }

      challengeResultRef.current = result;
      setFlowState('completed');
    },
    [alarm],
  );

  const handleGiveUp = useCallback(() => {
    if (!alarm) return;
    completedRef.current = true;
    stopAlarm(alarm.alarmId);
    stopAlarmNag(); // tear down the native re-fire loop
    clearAlarmPending();
    onGaveUp?.(alarm);
  }, [alarm, onGaveUp]);

  const handleDone = () => {
    if (alarm && challengeResultRef.current) {
      onCompleted(alarm, challengeResultRef.current);
    }
  };

  const todayCount = useMemo(() => {
    const base = 17500;
    const daySeed = new Date().getDate() * 17;
    const hourSeed = new Date().getHours() * 11;
    const minSeed = new Date().getMinutes() * 3;
    return (base + daySeed + hourSeed + minSeed).toLocaleString();
  }, []);

  if (!alarm) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      // No-op so Android back / system close cannot dismiss the gate:
      onRequestClose={() => {}}
    >
      {flowState === 'intro' && (
        <SafeAreaView style={[styles.root, { backgroundColor: isDark ? '#0D0F1E' : '#F2F4F5' }]}>
          <View style={styles.headerContainer}>
            <Text style={[styles.brandHeader, { color: isDark ? '#FFFFFF' : '#000000' }]}>Wakey</Text>
          </View>

          <View style={styles.centerContainer}>
            <Animated.Text entering={FadeIn.duration(600)} style={styles.sunEmoji}>🌞</Animated.Text>
            <Text style={[styles.titleText, { color: isDark ? '#FFFFFF' : '#000000' }]}>Alarm turned off!</Text>
            <Text style={[styles.subtitleText, { color: isDark ? '#A0A4B0' : '#666666' }]}>
              You joined {todayCount} others waking up today
            </Text>
          </View>

          <View style={styles.bottomContainer}>
            <View style={[styles.challengeDetailCard, { 
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', 
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              boxShadow: isDark ? "none" : "0 4px 12px rgba(0,0,0,0.04)"
            }]}>
              <Text style={[styles.challengeCardTitle, { color: isDark ? '#B0B4BA' : '#666666' }]}>
                Silencing Challenge
              </Text>
              <View style={styles.challengeBadgeRow}>
                <Text style={styles.challengeGlyph}>{getChallengeGlyph(alarm.challenge)}</Text>
                <Text style={[styles.challengeNameText, { color: isDark ? '#FFFFFF' : '#111111' }]}>
                  {getChallengeName(alarm.challenge).toUpperCase()}
                </Text>
                <Text style={styles.difficultyDot}>•</Text>
                <Text style={[styles.difficultyText, { color: theme.accent }]}>
                  {alarm.difficulty.toUpperCase()}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: isDark ? '#FFFFFF' : '#111111' }]}
              onPress={() => setFlowState('challenge')}
              activeOpacity={0.8}
            >
              <Text style={[styles.startButtonText, { color: isDark ? '#111111' : '#FFFFFF' }]}>
                {"I'm ready"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {flowState === 'challenge' && (
        <View style={styles.challengeRoot}>
          <ChallengeView
            alarm={alarm}
            onComplete={handleComplete}
            onAbort={allowGiveUp ? handleGiveUp : undefined}
          />
        </View>
      )}

      {flowState === 'completed' && (
        <SafeAreaView style={[styles.root, { backgroundColor: isDark ? '#0D0F1E' : '#F2F4F5' }]}>
          <View style={styles.headerContainer}>
            <Text style={[styles.brandHeader, { color: isDark ? '#FFFFFF' : '#000000' }]}>Wakey</Text>
          </View>

          <View style={styles.centerContainer}>
            <Animated.Text entering={FadeIn.duration(600)} style={styles.sunEmoji}>😎</Animated.Text>
            <Text style={[styles.titleText, { color: isDark ? '#FFFFFF' : '#000000' }]}>Good morning!</Text>
            <Text style={[styles.subtitleText, { color: isDark ? '#A0A4B0' : '#666666' }]}>
              You are officially awake. Go conquer the day! ☀️
            </Text>
          </View>

          <View style={styles.bottomContainer}>
            {streakInfo ? (
              <Animated.View 
                entering={FadeInDown.delay(200)}
                style={[
                  styles.streakCard, 
                  { 
                    backgroundColor: isDark ? 'rgba(255,180,92,0.1)' : '#FFF6ED',
                    borderColor: isDark ? 'rgba(255,180,92,0.15)' : '#FFE3D1',
                    boxShadow: isDark ? "none" : "0 4px 12px rgba(255,180,92,0.06)"
                  }
                ]}
              >
                <View style={styles.statRow}>
                  <Text style={styles.statIcon}>🔥</Text>
                  <Text style={[styles.statValue, { color: isDark ? '#FFB45C' : '#D9622E' }]}>
                    {streakInfo.currentStreak} Day Streak
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,180,92,0.1)' : '#FFE3D1' }]} />
                <View style={styles.statRow}>
                  <Text style={styles.statIcon}>🏆</Text>
                  <Text style={[styles.statValue, { color: isDark ? '#EEF0FF' : '#181C2E' }]}>
                    {streakInfo.totalBeaten} Alarms Beaten
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: isDark ? '#FFFFFF' : '#111111' }]}
              onPress={handleDone}
              activeOpacity={0.8}
            >
              <Text style={[styles.startButtonText, { color: isDark ? '#111111' : '#FFFFFF' }]}>
                Start My Day
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </Modal>
  );
}

function ChallengeView({
  alarm,
  onComplete,
  onAbort,
}: {
  alarm: ActiveAlarm;
  onComplete: (r: ChallengeResult) => void;
  onAbort?: () => void;
}) {
  const common = { difficulty: alarm.difficulty, onComplete, onAbort } as const;
  switch (alarm.challenge) {
    case 'squats':
      return <SquatsChallenge {...common} />;
    case 'pushups':
      return <PushupsChallenge {...common} />;
    case 'scan':
    case 'find-item':
      return <FindItemChallenge onComplete={onComplete} onAbort={onAbort} />;
    case 'math':
      return <MathChallenge {...common} />;
    case 'shake':
      return <ShakeChallenge {...common} />;
    case 'pattern':
      return <PatternChallenge {...common} />;
    case 'steps':
      return <StepsChallenge {...common} />;
    default:
      // Fail SAFE: if we don't recognise the challenge, fall back to math
      // so we don't trap the user behind a blank screen but still require completion.
      return <MathChallenge {...common} />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  challengeRoot: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  brandHeader: {
    fontFamily: 'Sora_700Bold',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 16,
  },
  sunEmoji: {
    fontSize: 100,
  },
  titleText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: 10,
  },
  subtitleText: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
    marginBottom: 20,
  },
  challengeDetailCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderCurve: 'continuous',
  },
  challengeCardTitle: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  challengeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  challengeGlyph: {
    fontSize: 20,
    color: '#FFB45C',
    fontFamily: 'Sora_600SemiBold',
  },
  challengeNameText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  difficultyDot: {
    fontSize: 14,
    color: 'rgba(128,128,128,0.5)',
  },
  difficultyText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  startButton: {
    width: '100%',
    maxWidth: 340,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  startButtonText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  streakCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 16,
    borderCurve: 'continuous',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    fontSize: 24,
  },
  statValue: {
    fontFamily: 'Sora_700Bold',
    fontSize: 18,
  },
  divider: {
    height: 1,
    width: '100%',
  },
});
