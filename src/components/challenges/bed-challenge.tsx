import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type ChallengeProps, type ChallengeResult } from '@/types/challenge';
import { Haptics } from '@/utils/alarm-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { useObjectDetection, YOLO26N } from 'react-native-executorch';
import CameraChallenge from './camera-challenge';
import ChallengeIntro from './challenge-intro';

type Bbox = { x1: number; y1: number; x2: number; y2: number };
type Detection = { bbox: Bbox; label: string; score: number };

const DETECTION_THRESHOLD = 0.5;
const HOLD_MS = 1500; // Point at bed for 1.5s to verify

export default function BedChallenge({
  onComplete,
  onAbort,
}: ChallengeProps) {
  const isDark = useColorScheme() !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const model = useObjectDetection({ model: YOLO26N });

  const [started, setStarted] = useState(false);
  const [box, setBox] = useState<Bbox | null>(null);
  const [locked, setLocked] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const holdSince = useRef<number | null>(null);
  const startedAt = useRef(0);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setIsActive(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result: ChallengeResult = {
      completed: true,
      attempts: 1,
      durationMs: Date.now() - startedAt.current,
    };
    onComplete(result);
  }, [onComplete]);

  const onDetections = useCallback(
    (detections: Detection[]) => {
      if (done.current || !started) return;

      // Filter for 'bed' detections
      const match = detections
        .filter((d) => d.label === 'bed' && d.score >= DETECTION_THRESHOLD)
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
    [finish, started],
  );

  const handleStart = useCallback(() => {
    setStarted(true);
    startedAt.current = Date.now();
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
          if (!isActive || !started) {
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
      [rof, onDetections, isActive, started],
    ),
  });

  useEffect(() => {
    return () => {
      // release model on unmount
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
      onAbort={onAbort}
      isActive={isActive}
    >
      {started ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
                rx={12}
              />
            </Svg>
          ) : null}

          {/* Status Overlay */}
          <View style={styles.bottom} pointerEvents="box-none">
            <Text style={styles.caption}>
              {locked ? `Hold steady on your bed…` : `Point camera at your made bed`}
            </Text>
          </View>
        </View>
      ) : (
        <ChallengeIntro
          title="Make Your Bed"
          steps={[
            'Get out of bed completely.',
            'Straighten your blankets and fluff your pillows.',
            'Point the camera at your made bed to verify.',
          ]}
          goal="Show your made bed to the camera to silence the alarm."
          onStart={handleStart}
        />
      )}
    </CameraChallenge>
  );
}

const styles = StyleSheet.create({
  bottom: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  caption: {
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
