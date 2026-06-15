/* eslint-disable react-hooks/immutability */
import { Theme } from '@/constants/theme';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface ChallengeCardProps {
  glyph: string;
  name: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}

export default function ChallengeCard({
  glyph,
  name,
  desc,
  selected,
  onPress,
  theme,
}: ChallengeCardProps) {
  const p = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(selected ? 1 : 0, { duration: 150 });
  }, [selected, p]);

  // Use solid colors to avoid alpha interpolation rendering glitches in React Native
  const unselectedBg = theme.surface;
  const selectedBg = theme.name === 'dark' ? '#352E34' : '#FEF0ED';
  const unselectedBorder = theme.name === 'dark' ? '#26293D' : '#F1F1F2';
  const selectedBorder = theme.accent;

  const aStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      [unselectedBorder, selectedBorder],
    ),
    backgroundColor: interpolateColor(
      p.value,
      [0, 1],
      [unselectedBg, selectedBg],
    ),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 100 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 100 }))}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.challengeCard, aStyle]}>
        <Text
          style={[
            styles.challengeGlyph,
            { color: selected ? theme.chipText : theme.textFaint },
          ]}
        >
          {glyph}
        </Text>
        <Text
          style={[
            styles.challengeName,
            { color: selected ? theme.text : theme.textDim },
          ]}
        >
          {name}
        </Text>
        <Text style={[styles.challengeDesc, { color: theme.textFaint }]}>
          {desc}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  challengeCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  challengeGlyph: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 20,
    marginBottom: 8,
  },
  challengeName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    marginBottom: 3,
  },
  challengeDesc: {
    fontFamily: 'Sora_400Regular',
    fontSize: 11.5,
  },
});
