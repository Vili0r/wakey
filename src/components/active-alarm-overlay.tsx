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
 *
 * Render this at the ROOT (above your navigator), driven by state — never as a
 * pushed route, so there is no back gesture or header to escape through.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Modal, View, StyleSheet } from 'react-native';
import type { ChallengeResult } from '@/types/challenge';
import { stopAlarm, markAlarmPending, clearAlarmPending } from '@/utils/alarm-store';
import { startAlarmSound } from '@/utils/alarm-sound';

import SquatsChallenge from './challenges/squats-challenge';
import PushupsChallenge from './challenges/pushups-challenge';
import FindItemChallenge from './challenges/find-item-challenge';
import MathChallenge from './challenges/math-challenge';
import ShakeChallenge from './challenges/shake-challenge';
import PatternChallenge from './challenges/pattern-challenge';
import StepsChallenge from './challenges/steps-challenge';

export type ActiveAlarm = {
  alarmId: string;
  challenge: string; // 'squats' | 'pushups' | 'scan' | 'math' | ...
  difficulty: 'gentle' | 'standard' | 'brutal';
};

export default function ActiveAlarmOverlay({
  alarm,
  onCompleted,
  onGaveUp,
  allowGiveUp = false,
}: {
  /** Non-null while an alarm is ringing and unmet. Null when nothing is active. */
  alarm: ActiveAlarm | null;
  /** Called only on successful challenge completion. Caller logs alarm_events + streaks. */
  onCompleted: (alarm: ActiveAlarm, result: ChallengeResult) => void;
  /** Called if you allow a gated escape. Logged as NOT completed. */
  onGaveUp?: (alarm: ActiveAlarm) => void;
  /** Product switch: keep an accessibility escape, or make it absolute. */
  allowGiveUp?: boolean;
}) {
  const visible = alarm !== null;
  const completedRef = useRef(false);

  // Persist a pending flag so a kill/relaunch can't bypass the gate.
  useEffect(() => {
    if (alarm) {
      completedRef.current = false;
      markAlarmPending(alarm); // write to file system
      // Start the un-silenceable in-app alarm. The system AlarmKit alarm was
      // only a wake/launch trigger; THIS is what the challenge must silence.
      startAlarmSound();
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
        startAlarmSound();
      }
    });
    return () => sub.remove();
  }, [visible, alarm]);

  const handleComplete = useCallback(
    (result: ChallengeResult) => {
      if (!alarm || completedRef.current) return;
      completedRef.current = true;
      stopAlarm(alarm.alarmId); // the ONLY place the alarm is silenced
      clearAlarmPending();
      onCompleted(alarm, result);
    },
    [alarm, onCompleted],
  );

  const handleGiveUp = useCallback(() => {
    if (!alarm) return;
    completedRef.current = true;
    stopAlarm(alarm.alarmId);
    clearAlarmPending();
    onGaveUp?.(alarm);
  }, [alarm, onGaveUp]);

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
      <View style={styles.root}>
        {renderChallenge(alarm, handleComplete, allowGiveUp ? handleGiveUp : undefined)}
      </View>
    </Modal>
  );
}

function renderChallenge(
  alarm: ActiveAlarm,
  onComplete: (r: ChallengeResult) => void,
  onAbort?: () => void,
) {
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
