/**
 * Push-ups challenge — front camera, proximity (body-scale) rep counting.
 *
 * Designed for the phone lying flat on the floor, camera facing up: as the
 * chest lowers toward the phone the body grows in frame; pushing up shrinks it.
 * That size swing is a far more reliable signal than the 2-D elbow angle, which
 * collapses under foreshortening when the arms point at the camera.
 */

import { useProximityRepCounter } from '@/hooks/use-proximity-rep-counter';
import {
  bodyScale,
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

  const { push } = useProximityRepCounter({
    minIntervalMs: 500,
    minAmplitudeRatio: 0.15,
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

      // Need at least both shoulders to measure body size reliably.
      const visible = visibleCount(person, ['LEFT_SHOULDER', 'RIGHT_SHOULDER']);
      if (visible < 2) {
        const now = Date.now();
        lowVisibilitySince.current ??= now;
        if (now - lowVisibilitySince.current > 2000) {
          setHint('Move so the camera sees your head and shoulders');
        }
        return;
      }
      lowVisibilitySince.current = null;

      const scale = bodyScale(person);
      if (scale == null) {
        setHint('Move so the camera sees your head and shoulders');
        return;
      }

      const state = push(scale);
      if (state === 'calibrating') setHint('Do a full push-up to calibrate');
      else if (state === 'bottom') setHint('Push up');
      else setHint('Lower your chest');
    },
    [push],
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
            'Place your phone flat on the floor, screen facing up.',
            'Get into a push-up position with your head and shoulders over it.',
            'Lower your chest toward the phone, then push back up.',
          ]}
          goal={`Complete ${target} push-ups to turn off the alarm.`}
          onStart={handleStart}
        />
      )}
    </CameraChallenge>
  );
}
