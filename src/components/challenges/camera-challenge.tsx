/**
 * CameraChallenge — model-agnostic camera shell.
 *
 * It does NOT own the model. The parent challenge owns the ExecuTorch hook and
 * passes in `frameOutput` (built with useFrameOutput), plus `isReady` and
 * `downloadProgress` for the warming-up UI. This keeps the scaffold reusable
 * across pose and object-detection challenges.
 *
 * Responsibilities:
 *  - Camera permission, including the *denied* case (offer a way out — never trap
 *    the user behind a ringing alarm).
 *  - Warming-up state with download progress, plus a stalled-download timeout
 *    that falls through to the abort path instead of spinning forever.
 *  - The deliberately low-prominence "I can't do this" abort after a delay.
 *  - Renders the live <Camera> (VisionCamera v5: outputs + orientationSource)
 *    with the challenge overlay as children.
 *
 * Requires a custom dev build (not Expo Go) and a real device (no simulator camera).
 */

import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type CameraFrameOutput,
} from 'react-native-vision-camera';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const ABORT_AFTER_MS = 20_000;
const DOWNLOAD_STALL_MS = 35_000;

export type CameraChallengeProps = {
  cameraPosition: 'front' | 'back';
  isReady: boolean;
  downloadProgress: number; // 0..1
  error?: unknown;
  /** Built by the parent via useFrameOutput({ pixelFormat:'rgb', ... }). */
  frameOutput: CameraFrameOutput;
  /** Short instruction shown while the camera is live (e.g. "Step into frame"). */
  instruction?: string;
  onAbort?: () => void;
  children?: React.ReactNode; // overlay (rep counter, bbox, hints)
  isActive?: boolean;
};

export default function CameraChallenge({
  cameraPosition,
  isReady,
  downloadProgress,
  error,
  frameOutput,
  instruction,
  onAbort,
  children,
  isActive = true,
}: CameraChallengeProps) {
  const isDark = useColorScheme() !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraPosition);

  const [permissionState, setPermissionState] =
    useState<'pending' | 'granted' | 'denied'>('pending');
  const [showAbort, setShowAbort] = useState(false);
  const [stalled, setStalled] = useState(false);

  // Ask once on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (hasPermission) {
        setPermissionState('granted');
        return;
      }
      const granted = await requestPermission();
      if (mounted) setPermissionState(granted ? 'granted' : 'denied');
    })();
    return () => {
      mounted = false;
    };
  }, [hasPermission, requestPermission]);

  // Reveal the abort affordance after a delay so the alarm is never inescapable.
  useEffect(() => {
    const t = setTimeout(() => setShowAbort(true), ABORT_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  // If the model download stalls (e.g. no network at 6am), stop spinning.
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isReady) {
      if (stallTimer.current) clearTimeout(stallTimer.current);
      setStalled(false);
      return;
    }
    stallTimer.current = setTimeout(() => setStalled(true), DOWNLOAD_STALL_MS);
    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
  }, [isReady, downloadProgress]);

  const AbortButton = onAbort ? (
    <Animated.View entering={FadeIn} style={styles.abortWrap}>
      <Pressable onPress={onAbort} hitSlop={8}>
        <Text style={[styles.abortText, { color: theme.textFaint }]}>
          I can’t do this
        </Text>
      </Pressable>
    </Animated.View>
  ) : null;

  // ---- Permission denied: don't trap the user ----
  if (permissionState === 'denied') {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          Camera access needed
        </Text>
        <Text style={[styles.body, { color: theme.textDim }]}>
          This challenge uses the camera. You can enable it in Settings, or switch
          this alarm to a different challenge.
        </Text>
        {onAbort && (
          <Pressable
            onPress={onAbort}
            style={[styles.cta, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          >
            <Text style={[styles.ctaText, { color: theme.text }]}>
              Use a different challenge
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ---- Model / device errors and stalls: fall through to abort ----
  if (error || stalled) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          {stalled ? 'Still downloading…' : 'Something went wrong'}
        </Text>
        <Text style={[styles.body, { color: theme.textDim }]}>
          {stalled
            ? "The challenge model is taking a while to download. Check your connection, or switch this alarm to a non-camera challenge."
            : "We couldn't start this challenge."}
        </Text>
        {onAbort && (
          <Pressable
            onPress={onAbort}
            style={[styles.cta, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
          >
            <Text style={[styles.ctaText, { color: theme.text }]}>
              Use a different challenge
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ---- Warming up: model still downloading/loading ----
  if (permissionState === 'pending' || !isReady) {
    const pct = Math.round((downloadProgress || 0) * 100);
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.title, { color: theme.text, marginTop: 16 }]}>
          Warming up
        </Text>
        <Text style={[styles.body, { color: theme.textDim }]}>
          {downloadProgress > 0 && downloadProgress < 1
            ? `Downloading challenge model… ${pct}%`
            : 'Getting the camera ready…'}
        </Text>
        <View style={[styles.bar, { backgroundColor: theme.surface }]}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.max(pct, 4)}%`, backgroundColor: theme.accent },
            ]}
          />
        </View>
        {showAbort && AbortButton}
      </View>
    );
  }

  // ---- No camera device (e.g. simulator) ----
  if (!device) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>No camera found</Text>
        <Text style={[styles.body, { color: theme.textDim }]}>
          Camera challenges need a real device.
        </Text>
        {AbortButton}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        outputs={[frameOutput]}
        isActive={isActive}
        orientationSource="device"
      />

      {/* Top instruction */}
      {instruction ? (
        <Animated.View entering={FadeInDown} style={styles.instructionWrap}>
          <Text style={styles.instruction}>{instruction}</Text>
        </Animated.View>
      ) : null}

      {/* Challenge overlay */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {children}
      </View>

      {showAbort && AbortButton}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 26,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bar: {
    width: 220,
    height: 6,
    borderRadius: 3,
    marginTop: 18,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  cta: {
    marginTop: 22,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  ctaText: { fontFamily: 'Sora_600SemiBold', fontSize: 14 },
  instructionWrap: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  instruction: {
    fontFamily: 'Sora_500Medium',
    fontSize: 14,
    color: '#fff',
  },
  abortWrap: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  abortText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
