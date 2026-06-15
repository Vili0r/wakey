import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface PressScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
}

export default function PressScale({
  children,
  onPress,
  onLongPress,
  style,
}: PressScaleProps) {
  const pressed = useSharedValue(0);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.97]) }],
  }));

  const handlePressIn = () => {
    // eslint-disable-next-line react-hooks/immutability
    pressed.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    // eslint-disable-next-line react-hooks/immutability
    pressed.value = withSpring(0, { damping: 20, stiffness: 300 });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, aStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
