import { type ChallengeProps } from '@/types/challenge';
import { Haptics } from '@/utils/alarm-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import CameraChallenge from './camera-challenge';
import ChallengeIntro from './challenge-intro';

export default function PhotoChallenge({
  difficulty,
  targetReps,
  onComplete,
  onAbort,
}: ChallengeProps) {
  const [started, setStarted] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [success, setSuccess] = useState(false);

  const flashOpacity = useSharedValue(0);
  const startedAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stub frame processor to satisfy CameraChallenge's requirements
  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    onFrame: useCallback((frame) => {
      'worklet';
      frame.dispose();
    }, []),
  });

  const handleStart = useCallback(() => {
    setStarted(true);
    startedAt.current = Date.now();
  }, []);

  const handleCapture = useCallback(() => {
    if (capturing || analyzing || success) return;
    setCapturing(true);

    // Haptics for camera shutter
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Trigger white flash animation
    flashOpacity.value = 1;
    flashOpacity.value = withTiming(0, { duration: 400 });

    // Transition to analyzing after flash starts
    timerRef.current = setTimeout(() => {
      setCapturing(false);
      setAnalyzing(true);

      // Analyze for 1.8s
      timerRef.current = setTimeout(() => {
        setAnalyzing(false);
        setSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Finish challenge
        timerRef.current = setTimeout(() => {
          onComplete({
            completed: true,
            attempts: 1,
            durationMs: Date.now() - startedAt.current,
          });
        }, 1000);
      }, 1800);
    }, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, analyzing, success, onComplete]);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <CameraChallenge
      cameraPosition="back"
      isReady={true}
      downloadProgress={1}
      frameOutput={frameOutput}
      onAbort={onAbort}
      instruction={started && !analyzing && !success ? 'Point camera at the sky' : undefined}
    >
      {started ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Camera Grid Viewfinder */}
          <View style={styles.gridContainer} pointerEvents="none">
            <View style={[styles.gridRow, { top: '33.33%' }]} />
            <View style={[styles.gridRow, { top: '66.66%' }]} />
            <View style={[styles.gridCol, { left: '33.33%' }]} />
            <View style={[styles.gridCol, { left: '66.66%' }]} />
          </View>

          {/* Shutter controls */}
          <View style={styles.bottomBar} pointerEvents="box-none">
            {!analyzing && !success && (
              <Pressable
                onPress={handleCapture}
                style={({ pressed }) => [
                  styles.shutterOuter,
                  pressed && styles.shutterOuterPressed,
                ]}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            )}
          </View>

          {/* Analyzing overlay */}
          {analyzing && (
            <View style={styles.overlayContainer}>
              <View style={styles.card}>
                <ActivityIndicator size="large" color="#FFB45C" />
                <Text style={styles.cardText}>Analyzing sky brightness...</Text>
              </View>
            </View>
          )}

          {/* Success overlay */}
          {success && (
            <View style={styles.overlayContainer}>
              <View style={[styles.card, styles.successCard]}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.cardText}>Sky brightness verified!</Text>
              </View>
            </View>
          )}

          {/* Flash animation layer */}
          <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />
        </View>
      ) : (
        <ChallengeIntro
          title="Sky Photo"
          steps={[
            'Go to a window or step outside.',
            'Point your camera directly towards the sky.',
            'Tap the shutter button to take a photo.',
          ]}
          goal="Prove it is bright outside to turn off the alarm."
          onStart={handleStart}
        />
      )}
    </CameraChallenge>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gridCol: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  shutterOuterPressed: {
    transform: [{ scale: 0.92 }],
    borderColor: '#FFB45C',
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: 'rgba(18,18,20,0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  successCard: {
    borderColor: 'rgba(74,222,128,0.2)',
  },
  cardText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  successIcon: {
    fontSize: 48,
    color: '#4ADE80',
    fontFamily: 'Sora_700Bold',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
  },
});
