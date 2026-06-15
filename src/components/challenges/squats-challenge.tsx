/**
 * Squats challenge — front camera, knee-angle rep counting.
 *
 * Architecture:
 *  - usePoseEstimation owns the model; runOnFrame runs inference in the camera
 *    worklet (pixelFormat 'rgb', frames dropped while busy).
 *  - Raw keypoints are shipped to JS via scheduleOnRN; the angle math + rep
 *    state machine run on the main thread (cheap at the throttled frame rate).
 *
 * NOTE: usePoseEstimation's runOnFrame requires react-native-executorch >= 0.9.x.
 * Verify the model constant against your installed version's model registry —
 * in 0.9.x it's models.pose_estimation.yolo26n().
 */

import { useRepCounter } from '@/hooks/use-rep-counter';
import { kneeAngle, type PersonKeypoints } from '@/utils/pose-math';
import { Haptics } from '@/utils/alarm-store';
import { type ChallengeProps, targetFor } from '@/types/challenge';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { models, usePoseEstimation } from 'react-native-executorch';
import { useSharedValue } from 'react-native-reanimated';
import CameraChallenge from './camera-challenge';
import RepOverlay from './rep-overlay';

export default function SquatsChallenge({
  difficulty,
  targetReps,
  onProgress,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const target = targetFor(difficulty, targetReps);
  const model = usePoseEstimation({ model: models.pose_estimation.yolo26n() });

  const [count, setCount] = useState(0);
  const [hint, setHint] = useState<string | null>('Step into frame');
  const [isActive, setIsActive] = useState(true);
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const noPersonFrames = useRef(0);

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
    downThreshold: 100, // knee bent
    upThreshold: 160, // standing
    minIntervalMs: 350,
    onRep: (c) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCount(c);
      onProgress?.(c, target);
      if (c >= target) finish(c);
    },
  });

  // Runs on the JS thread with raw keypoints from the worklet.
  const onPose = useCallback(
    (persons: PersonKeypoints[]) => {
      if (done.current) return;
      const person = persons?.[0];
      if (!person) {
        noPersonFrames.current += 1;
        // 10 FPS (throttled) * 3 seconds = 30 frames
        if (noPersonFrames.current > 30) {
          setHint('Too dark or no person detected. Ensure good lighting!');
        } else {
          setHint('Step into frame');
        }
        return;
      }
      noPersonFrames.current = 0;

      const angle = kneeAngle(person);
      if (angle == null) {
        setHint('Show your legs to the camera');
        return;
      }
      push(angle);
      setHint(hintFor(angle, 'Go lower', 'Stand tall'));
    },
    [push, hintFor],
  );

  const rof = model.runOnFrame;
  const isFront = true; // squats use the front camera
  const frameCount = useSharedValue(0);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';
        try {
          if (!isActive) {
            frame.dispose();
            return;
          }
          frameCount.value = (frameCount.value + 1) % 3;
          if (frameCount.value !== 0) {
            frame.dispose();
            return;
          }

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

  // Release the model when we leave the challenge.
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
      <RepOverlay count={count} target={target} hint={hint} />
    </CameraChallenge>
  );
}
