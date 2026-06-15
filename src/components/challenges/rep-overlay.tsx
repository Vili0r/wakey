/**
 * RepOverlay — shared overlay for squats & push-ups: big count, progress ring,
 * and a coaching hint, in the app's sunrise theme.
 */

import { THEMES } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export default function RepOverlay({
  count,
  target,
  hint,
}: {
  count: number;
  target: number;
  hint?: string | null;
}) {
  const isDark = useColorScheme() !== 'light';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const r = 70;
  const circumference = 2 * Math.PI * r;
  const progress = target > 0 ? Math.min(count / target, 1) : 0;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.ringWrap}>
        <Svg width={170} height={170} viewBox="0 0 170 170">
          <Circle
            cx={85}
            cy={85}
            r={r}
            stroke={'rgba(255,255,255,0.18)'}
            strokeWidth={8}
            fill="none"
          />
          <Circle
            cx={85}
            cy={85}
            r={r}
            stroke={theme.accent}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 85 85)"
          />
        </Svg>
        <View style={styles.center}>
          <Text style={styles.count}>
            {count}
            <Text style={styles.target}> / {target}</Text>
          </Text>
        </View>
      </View>

      {hint ? (
        <View style={styles.hintPill}>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  count: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 64,
    color: '#fff',
  },
  target: { fontSize: 28, color: 'rgba(255,255,255,0.7)' },
  hintPill: {
    marginTop: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  hintText: { fontFamily: 'Sora_500Medium', fontSize: 15, color: '#fff' },
});
