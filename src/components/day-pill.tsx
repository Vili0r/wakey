import { Theme } from '@/constants/theme';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface DayPillProps {
  letter: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}

export default function DayPill({
  letter,
  active,
  onPress,
  theme,
}: DayPillProps) {
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 150 });
  }, [active, p]);

  const aStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], ['transparent', theme.accent]),
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      [theme.surfaceBorder, theme.accent],
    ),
    transform: [{ scale: interpolate(p.value, [0, 0.5, 1], [1, 1.12, 1]) }],
  }));
  const tStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [theme.textFaint, theme.fabText]),
  }));

  return (
    <Pressable onPress={onPress} hitSlop={4}>
      <Animated.View style={[styles.dayPill, aStyle]}>
        <Animated.Text style={[styles.dayPillText, tStyle]}>{letter}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dayPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 13,
  },
});
