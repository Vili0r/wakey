import { Theme } from '@/constants/theme';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

interface HorizonArcProps {
  width: number;
  progress: number; // 0 → just set, 1 → about to ring
  theme: Theme;
}

export default function HorizonArc({
  width,
  progress,
  theme,
}: HorizonArcProps) {
  // Breathing glow on the sun
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.45, 0.95]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.85, 1.12]) }],
  }));

  const pad = 28;
  if (width <= pad * 2) return null;

  const rx = (width - pad * 2) / 2; // wide…
  const ry = 92; // …but shallow: a horizon, not a dome
  const baseY = ry + 22;
  const height = baseY + 14;
  const cx = width / 2;

  // Sun position along the arc (left horizon → right horizon)
  const angle = Math.PI * (1 - progress);
  const sx = cx + rx * Math.cos(angle);
  const sy = baseY - ry * Math.sin(angle);

  // Format to 1 decimal place to prevent long float parser issues in react-native-svg
  const rxF = parseFloat(rx.toFixed(1));
  const ryF = parseFloat(ry.toFixed(1));
  const baseYF = parseFloat(baseY.toFixed(1));
  const sxF = parseFloat(sx.toFixed(1));
  const syF = parseFloat(sy.toFixed(1));
  const endXF = parseFloat((width - pad).toFixed(1));

  const trackPath = `M ${pad} ${baseYF} A ${rxF} ${ryF} 0 0 1 ${endXF} ${baseYF}`;
  const litPath =
    progress > 0.005
      ? `M ${pad} ${baseYF} A ${rxF} ${ryF} 0 0 1 ${sxF} ${syF}`
      : '';

  const GLOW = 84;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <RadialGradient id="sunCore" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={theme.accent} stopOpacity="1" />
            <Stop offset="100%" stopColor={theme.accentDeep} stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* Dotted track — the night still to cross */}
        <Path
          d={trackPath}
          stroke={theme.arcTrack}
          strokeWidth={1.6}
          strokeDasharray="1, 7"
          strokeLinecap="round"
          fill="none"
        />

        {/* Lit portion — how far the sun has come */}
        {litPath !== '' && (
          <Path
            d={litPath}
            stroke={theme.accent}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
        )}

        {/* Horizon endpoints */}
        <Circle cx={pad} cy={baseYF} r={2.5} fill={theme.arcTrack} />
        <Circle cx={endXF} cy={baseYF} r={2.5} fill={theme.accentDeep} />

        {/* Sun core */}
        <Circle cx={sxF} cy={syF} r={7} fill="url(#sunCore)" />
      </Svg>

      {/* Soft breathing halo — SVG radial gradient, so it glows on both platforms */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: sxF - GLOW / 2,
            top: syF - GLOW / 2,
            width: GLOW,
            height: GLOW,
          },
          glowStyle,
        ]}
      >
        <Svg width={GLOW} height={GLOW} viewBox={`0 0 ${GLOW} ${GLOW}`}>
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.accent} stopOpacity="0.55" />
              <Stop offset="55%" stopColor={theme.accentDeep} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={theme.accentDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#sunGlow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
