import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

interface GlassButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  isDark: boolean;
  style?: any;
}

export default function GlassButton({
  children,
  style,
  isDark,
  ...props
}: GlassButtonProps) {
  const hasGlass = isLiquidGlassAvailable();
  if (hasGlass) {
    return (
      <GlassView isInteractive style={style}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          {...props}
        >
          {children}
        </TouchableOpacity>
      </GlassView>
    );
  }
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        style,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
        },
      ]}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}
