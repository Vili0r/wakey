/**
 * Find-an-item challenge — rear camera, object detection.
 * Redesigned flow:
 * 1. Select items you have at home (grid of 15 items).
 * 2. Transition screen ("One last question.").
 * 3. Selected Object screen with reroll and "Start Scan".
 * 4. Custom Camera Scanning screen with bracket frame, shutter, torch, zoom, and skip.
 */

import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Haptics } from '@/utils/alarm-store';
import type { ChallengeProps, ChallengeResult } from '@/types/challenge';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import Animated, { useSharedValue, FadeIn, ZoomIn } from 'react-native-reanimated';
import {
  useFrameOutput,
  type Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Rect } from 'react-native-svg';
import { useObjectDetection, YOLO26N } from 'react-native-executorch';
import CameraChallenge from './camera-challenge';
import { SFIcon } from '@/components/SF-icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FIND_ITEM_GRID as GRID_ITEMS,
  resolveFindItemIds,
  type FindItemGridItem as GridItem,
} from '@/constants/find-item-items';
import FindItemPicker from '@/components/find-item-picker';

type Bbox = { x1: number; y1: number; x2: number; y2: number };
type Detection = { bbox: Bbox; label: string; score: number };

const DETECTION_THRESHOLD = 0.45;
const HOLD_MS = 800; // continuous time the target must stay detected

type Step = 'select-items' | 'transition' | 'preview-item' | 'scan-item';

export default function FindItemChallenge({
  onComplete,
  onAbort,
  itemIds,
}: Pick<ChallengeProps, 'onComplete' | 'onAbort'> &
  Partial<ChallengeProps> & {
    /**
     * Items the user pre-selected when creating the alarm. When provided, the
     * in-challenge item-selection step is skipped and we go straight to the
     * target preview (with reroll to change the item). Omitted for the legacy
     * in-challenge selection flow (e.g. the 'scan' alias).
     */
    itemIds?: string[] | null;
  }) {
  const isDark = useColorScheme() !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Model loading starts warming up immediately on mount
  const model = useObjectDetection({ model: YOLO26N });

  // When the alarm carries a pre-selected item set, skip selection and drop the
  // user straight onto the target preview where they can reroll to change it.
  const fromAlarm = Array.isArray(itemIds) && itemIds.length > 0;
  const presetIds = useMemo(
    () => (fromAlarm ? resolveFindItemIds(itemIds) : GRID_ITEMS.map((i) => i.id)),
    [fromAlarm, itemIds],
  );

  const [step, setStep] = useState<Step>(fromAlarm ? 'preview-item' : 'select-items');
  const [selectedIds, setSelectedIds] = useState<string[]>(presetIds);
  const [targetItem, setTargetItem] = useState<GridItem | null>(() => {
    if (!fromAlarm) return null;
    const pool = GRID_ITEMS.filter((item) => presetIds.includes(item.id));
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  });
  const [pickerVisible, setPickerVisible] = useState(false);

  // Camera settings states
  const [torchState, setTorchState] = useState<'off' | 'on'>('off');
  const [isZoomed, setIsZoomed] = useState(false);
  const [cameraErrorText, setCameraErrorText] = useState<string | null>(null);
  const errorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [box, setBox] = useState<Bbox | null>(null);
  const [locked, setLocked] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [succeeded, setSucceeded] = useState(false);

  const targetItemRef = useRef(targetItem);
  useEffect(() => {
    targetItemRef.current = targetItem;
  }, [targetItem]);

  const holdSince = useRef<number | null>(null);
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(1);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const done = useRef(false);
  const lastSeenTime = useRef<number>(0);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setIsActive(false);
    setSucceeded(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result: ChallengeResult = {
      completed: true,
      attempts: attempts.current,
      durationMs: Date.now() - startedAt.current,
    };
    // Linger on the success confirmation for a beat before redirecting.
    successTimeout.current = setTimeout(() => {
      onComplete?.(result);
    }, 1800);
  }, [onComplete]);

  const onDetections = useCallback(
    (detections: Detection[]) => {
      if (done.current) return;
      const currentTarget = targetItemRef.current;
      if (!currentTarget) return;

      const match = detections
        .filter(
          (d) =>
            [currentTarget.cocoLabel, ...(currentTarget.cocoAliases || [])].includes(d.label) &&
            d.score >= DETECTION_THRESHOLD
        )
        .sort((a, b) => b.score - a.score)[0];

      if (!match) {
        holdSince.current = null;
        setBox(null);
        setLocked(false);
        return;
      }

      lastSeenTime.current = Date.now();
      setBox(match.bbox);
      const now = Date.now();
      holdSince.current ??= now;
      const held = now - holdSince.current;
      setLocked(held >= HOLD_MS * 0.4);
      if (held >= HOLD_MS) finish();
    },
    [finish],
  );

  const toggleItem = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least one item checked
        return prev.filter((x) => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('transition');
  };

  // Auto-advance transition step to preview step after 1.2s
  useEffect(() => {
    if (step === 'transition') {
      const timer = setTimeout(() => {
        const pool = GRID_ITEMS.filter((item) => selectedIds.includes(item.id));
        const randomItem = pool[Math.floor(Math.random() * pool.length)];
        setTargetItem(randomItem);
        setStep('preview-item');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [step, selectedIds]);

  const rerollObject = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickerVisible(true);
  };

  const handleShutterPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (box !== null || locked || (Date.now() - lastSeenTime.current < 1500)) {
      finish();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setCameraErrorText(`No ${targetItem?.name} detected in frame`);
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
      errorTimeout.current = setTimeout(() => {
        setCameraErrorText(null);
      }, 2500);
    }
  }, [box, locked, targetItem, finish]);

  const rof = model.runOnFrame;
  const frameCount = useSharedValue(0);

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';
        // Dispose the frame exactly once. The previous version disposed in both
        // the early-return branches and the finally block, which double-disposed
        // the underlying HybridObject and threw "cannot call HybridObject.dispose",
        // killing the detection pipeline entirely.
        try {
          if (!isActive || step !== 'scan-item') {
            return;
          }
          frameCount.value = (frameCount.value + 1) % 3;
          if (frameCount.value !== 0) {
            return;
          }

          if (!rof) return;
          const result = rof(frame, false, { detectionThreshold: DETECTION_THRESHOLD });
          if (result) scheduleOnRN(onDetections, result as Detection[]);
        } finally {
          frame.dispose();
        }
      },
      [rof, onDetections, isActive, step, frameCount],
    ),
  });

  useEffect(() => {
    return () => {
      // @ts-expect-error — release/unload exists on the module; name may vary by version
      model.release?.();
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
      if (successTimeout.current) clearTimeout(successTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boxColor = useMemo(() => theme.accent, [theme.accent]);

  // Layout sizing
  const gridPadding = 24;
  const gridGap = 12;
  const itemWidth = (width - gridPadding * 2 - gridGap * 2) / 3;

  const checkBgColor = theme.name === 'light' ? '#111111' : '#FFFFFF';
  const checkTickColor = theme.name === 'light' ? '#FFFFFF' : '#111111';

  // ---- 1. Select Items Screen ----
  if (step === 'select-items') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <View style={styles.progressBarWrapper}>
          <ProgressBar pct="70%" />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 90, 100) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.serifTitle, { color: theme.text }]}>
            {"Remove items you don't have at home"}
          </Text>

          <View style={styles.gridContainer}>
            {GRID_ITEMS.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleItem(item.id)}
                  style={[
                    styles.gridItem,
                    {
                      width: itemWidth,
                      backgroundColor: theme.surface,
                      borderColor: isSelected ? theme.accent : theme.surfaceBorder,
                      opacity: isSelected ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={styles.gridEmoji}>{item.emoji}</Text>
                  <Text style={[styles.gridName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View
                    style={[
                      styles.checkmarkCircle,
                      {
                        backgroundColor: isSelected ? checkBgColor : 'transparent',
                        borderColor: isSelected ? checkBgColor : theme.textFaint,
                      },
                    ]}
                  >
                    {isSelected && (
                      <SFIcon name="checkmark" size={10} color={checkTickColor} weight="bold" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            onPress={handleContinue}
            style={[styles.continueBtn, { backgroundColor: theme.name === 'light' ? '#111' : '#FFF' }]}
          >
            <Text style={[styles.continueBtnText, { color: theme.name === 'light' ? '#FFF' : '#111' }]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- 2. Transition Screen ----
  if (step === 'transition') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <View style={styles.progressBarWrapper}>
          <ProgressBar pct="85%" />
        </View>

        <Pressable
          onPress={() => setStep('select-items')}
          style={[styles.backButton, { top: insets.top + 20 }]}
          hitSlop={12}
        >
          <SFIcon name="chevron.left" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.centeredContent}>
          <Text style={[styles.serifTitle, { color: theme.text, fontSize: 36 }]}>
            One last question.
          </Text>
        </View>
      </View>
    );
  }

  if (step === 'preview-item') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        {!fromAlarm && (
          <Pressable
            onPress={() => setStep('select-items')}
            style={[styles.backButton, { top: insets.top + 20 }]}
            hitSlop={12}
          >
            <SFIcon name="chevron.left" size={24} color={theme.text} />
          </Pressable>
        )}

        <View style={styles.centeredContent}>
          <Text style={styles.objectPreviewLabel}>YOUR OBJECT</Text>
          <Text style={styles.largeEmoji}>{targetItem?.emoji}</Text>
          <Pressable onPress={rerollObject} style={styles.rerollRow} hitSlop={8}>
            <Text style={[styles.objectNameText, { color: theme.text }]}>
              {targetItem?.name}
            </Text>
            <SFIcon name="arrow.counterclockwise" size={20} color={theme.textDim} />
          </Pressable>
        </View>

        <View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            onPress={() => setStep('scan-item')}
            style={[styles.continueBtn, { backgroundColor: theme.name === 'light' ? '#111' : '#FFF' }]}
          >
            <Text style={[styles.continueBtnText, { color: theme.name === 'light' ? '#FFF' : '#111' }]}>
              Start Scan
            </Text>
          </Pressable>
        </View>

        <FindItemPicker
          visible={pickerVisible}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          onClose={() => {
            setPickerVisible(false);
            const pool = GRID_ITEMS.filter((item) => selectedIds.includes(item.id));
            if (pool.length > 0 && (!targetItem || !selectedIds.includes(targetItem.id))) {
              setTargetItem(pool[Math.floor(Math.random() * pool.length)] ?? null);
            }
          }}
          theme={{
            bg: theme.bg,
            surface: theme.surface,
            surfaceBorder: theme.surfaceBorder,
            text: theme.text,
            textFaint: theme.textDim,
            accent: theme.accent,
            chipBg: isDark ? '#1F223B' : '#E5E8F0',
            fabText: theme.name === 'light' ? '#FFF' : '#111',
          }}
        />
      </View>
    );
  }

  // ---- 4. Camera Scan Screen ----
  return (
    <View style={styles.scanRoot}>
      <CameraChallenge
        cameraPosition="back"
        isReady={model.isReady}
        downloadProgress={model.downloadProgress}
        error={model.error}
        frameOutput={frameOutput}
        onAbort={onAbort}
        isActive={isActive}
        hideDefaultAbort={true}
        torch={torchState}
        zoom={isZoomed ? 2 : 1}
      >
        {/* Success confirmation overlay — shown briefly before redirecting */}
        {succeeded ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.successOverlay}>
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.successCircle}>
              <SFIcon name="checkmark" size={56} color="#FFFFFF" weight="bold" />
            </Animated.View>
            <Text style={styles.successTitle}>Found it!</Text>
            <Text style={styles.successSubtitle}>{targetItem?.name} detected</Text>
          </Animated.View>
        ) : null}

        {/* Change Item Button */}
        <Pressable
          onPress={() => setStep('preview-item')}
          style={[styles.changeItemBtn, { top: insets.top + 20, left: 20 }]}
          hitSlop={12}
        >
          <SFIcon name="chevron.left" size={16} color="#FFFFFF" weight="bold" />
          <Text style={styles.changeItemText}>Change Item</Text>
        </Pressable>

        {/* Live bounding box overlay from Executorch */}
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

        {/* Central Brackets frame overlay */}
        <View style={styles.bracketsContainer} pointerEvents="none">
          <View style={styles.bracketsBox}>
            <View style={[styles.bracket, styles.bracketTopLeft, { borderColor: locked ? '#4CAF50' : '#FFFFFF' }]} />
            <View style={[styles.bracket, styles.bracketTopRight, { borderColor: locked ? '#4CAF50' : '#FFFFFF' }]} />
            <View style={[styles.bracket, styles.bracketBottomLeft, { borderColor: locked ? '#4CAF50' : '#FFFFFF' }]} />
            <View style={[styles.bracket, styles.bracketBottomRight, { borderColor: locked ? '#4CAF50' : '#FFFFFF' }]} />
          </View>

          <View style={styles.targetIndicatorContainer}>
            <Text style={styles.targetIndicatorEmoji}>{targetItem?.emoji}</Text>
            <Text style={styles.targetIndicatorText}>{targetItem?.name}</Text>
          </View>
        </View>

        {/* Feedback Hint Toast */}
        {!succeeded ? (
          <View style={styles.toastContainer} pointerEvents="none">
            <Text style={styles.toastText}>
              {cameraErrorText || (box ? "Hold steady…" : `Point camera at a ${targetItem?.name}`)}
            </Text>
          </View>
        ) : null}

        {/* Camera controls panel */}
        <View style={styles.cameraControlsContainer} pointerEvents="box-none">
          {/* Zoom Factor Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsZoomed((prev) => !prev);
            }}
            style={styles.cameraCircleBtn}
          >
            <Text style={styles.zoomText}>{isZoomed ? '2x' : '1x'}</Text>
          </Pressable>

          {/* Shutter Button */}
          <Pressable
            onPress={handleShutterPress}
            style={styles.shutterOuterCircle}
          >
            <View style={styles.shutterInnerCircle} />
          </Pressable>

          {/* Flashlight/Torch Button */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTorchState((prev) => (prev === 'off' ? 'on' : 'off'));
            }}
            style={styles.cameraCircleBtn}
          >
            <SFIcon
              name="bolt.fill"
              size={20}
              color={torchState === 'on' ? '#FFC787' : '#FFFFFF'}
            />
          </Pressable>
        </View>

        {/* Bottom Skip Button */}
        {onAbort && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAbort();
            }}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>⏩ Skip</Text>
          </Pressable>
        )}
      </CameraChallenge>
    </View>
  );
}

// Progress Bar helper component
const ProgressBar = ({ pct }: { pct: string }) => {
  const isDark = useColorScheme() !== 'light';
  const trackBg = isDark ? '#1F223B' : '#E5E8F0';
  return (
    <View style={{ height: 4, width: '100%', backgroundColor: trackBg, borderRadius: 2, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: pct as any, backgroundColor: '#F59A3E' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scanRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  progressBarWrapper: {
    paddingHorizontal: 24,
    marginTop: 10,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  serifTitle: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 28,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
    width: '100%',
  },
  gridItem: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderCurve: 'continuous',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
  },
  gridEmoji: {
    fontSize: 28,
  },
  gridName: {
    fontFamily: 'Sora_500Medium',
    fontSize: 12,
  },
  checkmarkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  continueBtn: {
    width: '100%',
    maxWidth: 340,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  continueBtnText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  objectPreviewLabel: {
    fontFamily: 'Sora_500Medium',
    fontSize: 12,
    color: '#8A8C99',
    letterSpacing: 1.5,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  largeEmoji: {
    fontSize: 88,
    marginBottom: 20,
  },
  rerollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  objectNameText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 28,
  },
  cameraCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeItemBtn: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 6,
  },
  changeItemText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  bracketsContainer: {
    position: 'absolute',
    top: '25%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  bracketsBox: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: 30,
    height: 30,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  targetIndicatorContainer: {
    position: 'absolute',
    bottom: 280,
    alignItems: 'center',
    gap: 4,
  },
  targetIndicatorEmoji: {
    fontSize: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  targetIndicatorText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toastText: {
    fontFamily: 'Sora_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  cameraControlsContainer: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  shutterOuterCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
  },
  zoomText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    zIndex: 50,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(52, 199, 89, 0.4)',
  },
  successTitle: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 40,
    color: '#FFFFFF',
  },
  successSubtitle: {
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  skipButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  skipButtonText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
