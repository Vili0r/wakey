/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';


export const Colors = {
  light: {
    // Core neutrals
    text: '#181C2E',
    textSecondary: '#60646C',
    textFaint: '#9DA1AC',
    background: '#F1F4FA',
    backgroundEdge: '#E8EDF7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E0E1E6',
    border: 'rgba(24, 28, 46, 0.06)',
 
    // Sunrise accent
    accent: '#F59A3E',       // amber
    accentDeep: '#F25C3C',   // coral
    accentSoft: 'rgba(242, 92, 60, 0.09)',
    accentText: '#D9622E',   // accent label on soft bg
 
    // Component-specific
    horizon: 'rgba(242, 92, 60, 0.28)',
    arcTrack: 'rgba(24, 28, 46, 0.30)',
    toggleOff: 'rgba(24, 28, 46, 0.14)',
    onAccent: '#FFFFFF',     // text/icon sitting on the accent gradient
  },
  dark: {
    // Core neutrals
    text: '#EEF0FF',
    textSecondary: '#B0B4BA',
    textFaint: 'rgba(238, 240, 255, 0.32)',
    background: '#0D0F1E',
    backgroundEdge: '#13152A',
    backgroundElement: '#171A2E',
    backgroundSelected: '#2E3135',
    border: 'rgba(235, 238, 255, 0.07)',
 
    // Sunrise accent
    accent: '#FFB45C',       // amber
    accentDeep: '#FF6E50',   // coral
    accentSoft: 'rgba(255, 180, 92, 0.13)',
    accentText: '#FFC787',   // accent label on soft bg
 
    // Component-specific
    horizon: 'rgba(255, 180, 92, 0.35)',
    arcTrack: 'rgba(238, 240, 255, 0.28)',
    toggleOff: 'rgba(238, 240, 255, 0.14)',
    onAccent: '#1A1206',     // text/icon sitting on the accent gradient
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
