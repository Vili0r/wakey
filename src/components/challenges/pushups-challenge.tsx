/**
 * Push-ups challenge — front camera, elbow-angle rep counting.
 * Mirrors Squats but tracks SHOULDER-ELBOW-WRIST and guards for upper-body
 * visibility (phone propped to see your upper body).
 */

import { useRepCounter } from '@/hooks/use-rep-counter';
import {
  elbowAngle,
  visibleCount,
  type PersonKeypoints,
} from '@/utils/pose-math';
import { Haptics } from '@/utils/alarm-store';
import { type ChallengeProps, targetFor } from '@/types/challenge';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { models, usePoseEstimation } from 'react-native-executorch';
import { useSharedValue } from 'react-native-reanimated';
import CameraChallenge from './camera-challenge';
import ChallengeIntro from './challenge-intro';
import RepOverlay from './rep-overlay';

export default function PushupsChallenge({
  difficulty,
  targetReps,
  onProgress,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps);
  const model = usePoseEstimation({ model: models.pose_estimation.yolo26n() });

  const [count, setCount] = useState(0);
  const [hint, setHint] = useState<string | null>('Get into position');
  const [isActive, setIsActive] = useState(true);
  const [started, setStarted] = useState(false);
  // Mirror `started` into a ref so the pose callback (a stable useCallback) can
  // read it without being re-created on every start toggle.
  const startedRef = useRef(false);
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const noPersonFrames = useRef(0);
  // Track how long upper body has been out of view to surface a guard message.
  const lowVisibilitySince = useRef<number | null>(null);

  const finish = useCallback(
    (finalCount: number) => {
      if (done.current) return;
      done.current = true;
      setIsActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete({
        completed: true,
        attempts: finalCount,
        durationMs: Date.now() - startedAt.current,
      });
    },
    [onComplete],
  );

  const { push, hintFor } = useRepCounter({
    downThreshold: 90, // chest lowered, elbow bent
    upThreshold: 160, // arms extended
    minIntervalMs: 350,
    onRep: (c) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCount(c);
      onProgress?.(c, target);
      if (c >= target) finish(c);
    },
  });

  const handleStart = useCallback(() => {
    startedRef.current = true;
    startedAt.current = Date.now();
    setStarted(true);
  }, []);

  const onPose = useCallback(
    (persons: PersonKeypoints[]) => {
      if (done.current || !startedRef.current) return;
      const person = persons?.[0];
      if (!person) {
        noPersonFrames.current += 1;
        // 10 FPS (throttled) * 3 seconds = 30 frames
        if (noPersonFrames.current > 30) {
          setHint('Too dark or no person detected. Ensure good lighting!');
        } else {
          setHint('Get into position');
        }
        return;
      }
      noPersonFrames.current = 0;

      const visible = visibleCount(person, [
        'LEFT_SHOULDER',
        'RIGHT_SHOULDER',
        'LEFT_ELBOW',
        'RIGHT_ELBOW',
        'LEFT_WRIST',
        'RIGHT_WRIST',
      ]);
      if (visible < 2) {
        const now = Date.now();
        lowVisibilitySince.current ??= now;
        if (now - lowVisibilitySince.current > 2000) {
          setHint('Prop your phone so it can see your upper body');
        }
        return;
      }
      lowVisibilitySince.current = null;

      const angle = elbowAngle(person);
      if (angle == null) {
        setHint('Show your arms to the camera');
        return;
      }
      push(angle);
      setHint(hintFor(angle, 'Lower your chest', 'Push up'));
    },
    [push, hintFor],
  );

  const rof = model.runOnFrame;
  const isFront = true;
  const frameCount = useSharedValue(0);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';
        // The `finally` block disposes the frame on every path, so branches
        // here must NOT call frame.dispose() themselves — doing so double-frees
        // the native frame ("NativeState is null").
        try {
          if (!isActive) return;
          frameCount.value = (frameCount.value + 1) % 3;
          if (frameCount.value !== 0) return;

          if (!rof) return;
          const result = rof(frame, isFront);
          if (result) scheduleOnRN(onPose, result as PersonKeypoints[]);
        } finally {
          frame.dispose();
        }
      },
      [rof, onPose, isActive],
    ),
  });

  useEffect(() => {
    return () => {
      // @ts-expect-error — release/unload exists on the module; name may vary by version
      model.release?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CameraChallenge
      cameraPosition="front"
      isReady={model.isReady}
      downloadProgress={model.downloadProgress}
      error={model.error}
      frameOutput={frameOutput}
      onAbort={onAbort}
      isActive={isActive}
    >
      {started ? (
        <RepOverlay count={count} target={target} hint={hint} />
      ) : (
        <ChallengeIntro
          title="Push-ups"
          steps={[
            'Prop your phone to the side so it can see your upper body.',
            'Get into a push-up position facing the camera.',
            'Lower your chest, then push back up.',
          ]}
          goal={`Complete ${target} push-ups to turn off the alarm.`}
          onStart={handleStart}
        />
      )}
    </CameraChallenge>
  );
}
