import { Theme } from '@/constants/theme';
import { Haptics } from '@/utils/alarm-store';
import React, { useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  SharedValue,
} from 'react-native-reanimated';

export const ITEM_H = 52;
const VISIBLE = 5; // odd number; 2 above + selected + 2 below
const WHEEL_H = ITEM_H * VISIBLE;
export const WHEEL_PAD = (WHEEL_H - ITEM_H) / 2;

interface WheelItemProps {
  index: number;
  label: string;
  scrollY: SharedValue<number>;
  theme: Theme;
}

function WheelItem({
  index,
  label,
  scrollY,
  theme,
}: WheelItemProps) {
  const aStyle = useAnimatedStyle(() => {
    const center = index * ITEM_H;
    const d = scrollY.value - center; // distance from centerline, px
    return {
      opacity: interpolate(
        Math.abs(d),
        [0, ITEM_H, ITEM_H * 2],
        [1, 0.38, 0.14],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            Math.abs(d),
            [0, ITEM_H, ITEM_H * 2],
            [1, 0.78, 0.6],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotateX: `${interpolate(
            d,
            [-ITEM_H * 2, 0, ITEM_H * 2],
            [-32, 0, 32],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.wheelItem, aStyle]}>
      <Text style={[styles.wheelDigit, { color: theme.text }]}>{label}</Text>
    </Animated.View>
  );
}

interface WheelProps {
  values: string[];
  initialIndex: number;
  onChange: (index: number) => void;
  theme: Theme;
  width: number;
}

export default function Wheel({
  values,
  initialIndex,
  onChange,
  theme,
  width,
}: WheelProps) {
  const scrollY = useSharedValue(initialIndex * ITEM_H);
  const ref = useRef<Animated.ScrollView>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <Animated.ScrollView
      ref={ref}
      style={{ height: WHEEL_H, width }}
      contentContainerStyle={{ paddingVertical: WHEEL_PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
      onMomentumScrollEnd={(e) => {
        const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(Math.min(Math.max(idx, 0), values.length - 1));
      }}
    >
      {values.map((v, i) => (
        <WheelItem key={`${v}-${i}`} index={i} label={v} scrollY={scrollY} theme={theme} />
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelDigit: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 44,
    letterSpacing: -1,
    paddingHorizontal: 10,
  },
});
