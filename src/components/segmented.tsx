import { Theme } from '@/constants/theme';
import { Haptics } from '@/utils/alarm-store';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface SegmentedProps {
  options: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
  theme: Theme;
  width: number;
}

export default function Segmented({
  options,
  selectedIndex,
  onChange,
  theme,
  width,
}: SegmentedProps) {
  const segW = (width - 8) / options.length;
  const p = useSharedValue(selectedIndex);
  useEffect(() => {
    p.value = withSpring(selectedIndex, { damping: 18, stiffness: 220 });
  }, [selectedIndex, p]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * segW }],
  }));

  return (
    <View
      style={[
        styles.segTrack,
        { width, backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
      ]}
    >
      <Animated.View
        style={[
          styles.segThumb,
          { width: segW, backgroundColor: theme.chipBg, borderColor: theme.accent },
          thumbStyle,
        ]}
      />
      {options.map((opt, i) => (
        <Pressable
          key={opt}
          style={[styles.segOption, { width: segW }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(i);
          }}
        >
          <Text
            style={[
              styles.segLabel,
              {
                color: i === selectedIndex ? theme.chipText : theme.textFaint,
                fontFamily: i === selectedIndex ? 'Sora_600SemiBold' : 'Sora_500Medium',
              },
            ]}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segTrack: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    position: 'relative',
  },
  segThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  segOption: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLabel: {
    fontSize: 12.5,
    letterSpacing: 0.6,
  },
});
