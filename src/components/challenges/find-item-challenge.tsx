/**
 * Find-an-item challenge — rear camera, object detection.
 *
 * Picks a random everyday COCO object and asks the user to point the camera at
 * it. Confirms only when the target label holds with confidence for a short
 * continuous window (debounced so one noisy frame can't pass). Draws a live
 * bounding box so the user sees it lock on, and lets them re-roll the target.
 *
 * Verify the model constant against your installed version (YOLO26N or
 * SSDLITE_320_MOBILENET_V3_LARGE). bbox coords are returned in screen space;
 * if your overlay looks offset, confirm orientationSource="device" and the
 * coordinate mapping per the VisionCamera Integration guide.
 */

import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Haptics } from '@/utils/alarm-store';
import type { ChallengeProps, ChallengeResult } from '@/types/challenge';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  useFrameOutput,
  type Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Rect } from 'react-native-svg';
// Verify the exact export for your installed version.
import { useObjectDetection, YOLO26N } from 'react-native-executorch';
import CameraChallenge from './camera-challenge';

type Bbox = { x1: number; y1: number; x2: number; y2: number };
type Detection = { bbox: Bbox; label: string; score: number };

// COCO classes people reliably have nearby and the model detects well.
const TARGETS = [
  'cup',
  'bottle',
  'book',
  'cell phone',
  'toothbrush',
  'remote',
  'clock',
  'chair',
] as const;

const DETECTION_THRESHOLD = 0.6;
const HOLD_MS = 800; // continuous time the target must stay detected

function pickTarget(exclude?: string) {
  const pool = TARGETS.filter((t) => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function FindItemChallenge({
  onComplete,
  onAbort,
}: Pick<ChallengeProps, 'onComplete' | 'onAbort'> & Partial<ChallengeProps>) {
  const isDark = useColorScheme() !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const model = useObjectDetection({ model: YOLO26N });

  const [target, setTarget] = useState<string>(() => pickTarget());
  const [box, setBox] = useState<Bbox | null>(null);
  const [locked, setLocked] = useState(false);

  const [isActive, setIsActive] = useState(true);
  const targetRef = useRef(target);
  targetRef.current = target;
  const holdSince = useRef<number | null>(null);
  const attempts = useRef(1);
  const startedAt = useRef(Date.now());
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setIsActive(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result: ChallengeResult = {
      completed: true,
      attempts: attempts.current,
      durationMs: Date.now() - startedAt.current,
    };
    onComplete(result);
  }, [onComplete]);

  const onDetections = useCallback(
    (detections: Detection[]) => {
      if (done.current) return;
      const match = detections
        .filter((d) => d.label === targetRef.current && d.score >= DETECTION_THRESHOLD)
        .sort((a, b) => b.score - a.score)[0];

      if (!match) {
        holdSince.current = null;
        setBox(null);
        setLocked(false);
        return;
      }

      setBox(match.bbox);
      const now = Date.now();
      holdSince.current ??= now;
      const held = now - holdSince.current;
      setLocked(held >= HOLD_MS * 0.4);
      if (held >= HOLD_MS) finish();
    },
    [finish],
  );

  const reroll = useCallback(() => {
    attempts.current += 1;
    holdSince.current = null;
    setBox(null);
    setLocked(false);
    setTarget((prev) => pickTarget(prev));
  }, []);

  const rof = model.runOnFrame;
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
          const result = rof(frame, false, { detectionThreshold: DETECTION_THRESHOLD });
          if (result) scheduleOnRN(onDetections, result as Detection[]);
        } finally {
          frame.dispose();
        }
      },
      [rof, onDetections, isActive],
    ),
  });

  useEffect(() => {
    return () => {
      // @ts-expect-error — release/unload exists on the module; name may vary by version
      model.release?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boxColor = useMemo(() => theme.accent, [theme.accent]);

  return (
    <CameraChallenge
      cameraPosition="back"
      isReady={model.isReady}
      downloadProgress={model.downloadProgress}
      error={model.error}
      frameOutput={frameOutput}
      instruction={`Find a ${target}`}
      onAbort={onAbort}
      isActive={isActive}
    >
      {/* Live bounding box */}
      {box ? (
        <Svg style={StyleSheet.absoluteFill}>
          <Rect
            x={box.x1}
            y={box.y1}
            width={Math.max(box.x2 - box.x1, 0)}
            height={Math.max(box.y2 - box.y1, 0)}
            stroke={boxColor}
            strokeWidth={locked ? 4 : 2}
            fill={locked ? `${boxColor}22` : 'transparent'}
            rx={10}
          />
        </Svg>
      ) : null}

      {/* Re-roll */}
      <View style={styles.bottom} pointerEvents="box-none">
        <Text style={styles.caption}>
          {locked ? `Hold steady…` : `Point your camera at a ${target}`}
        </Text>
        <Pressable
          onPress={reroll}
          style={[styles.reroll, { borderColor: 'rgba(255,255,255,0.4)' }]}
        >
          <Text style={styles.rerollText}>Different item</Text>
        </Pressable>
      </View>
    </CameraChallenge>
  );
}

const styles = StyleSheet.create({
  bottom: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
  },
  caption: {
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  reroll: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  rerollText: { fontFamily: 'Sora_600SemiBold', fontSize: 13, color: '#fff' },
});
