import { SymbolView, type SFSymbol } from 'expo-symbols';
import { type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

interface SFIconProps {
  name: SFSymbol;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
}

/**
 * Wrapper around expo-symbols SymbolView that provides a simpler API
 * matching the old @expo/vector-icons pattern: <SFIcon name="..." size={...} color={...} />
 */
export function SFIcon({ name, size = 24, color, style, weight }: SFIconProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color as string}
      weight={weight}
      style={style}
    />
  );
}

export default SFIcon;
