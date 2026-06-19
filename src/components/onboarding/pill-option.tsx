/**
 * pill-option — a single selectable answer row in the onboarding survey.
 * Uses the app's chip styling: soft sunrise fill + accent border + check when
 * selected, neutral surface when not. Works for both single and multi select.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import { Haptics } from '@/utils/alarm-store';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

export function PillOption({
  label,
  hint,
  selected,
  index,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 60)
        .duration(420)
        .reduceMotion(ReduceMotion.System)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: selected ? OB.accentSoft : OB.surface,
            borderColor: selected ? OB.accent : OB.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={styles.textWrap}>
          <Text
            style={[
              styles.label,
              { color: selected ? OB.accentText : OB.text },
            ]}
          >
            {label}
          </Text>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
        <View
          style={[
            styles.check,
            {
              borderColor: selected ? OB.accent : OB.border,
              backgroundColor: selected ? OB.accent : 'transparent',
            },
          ]}
        >
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 17,
    marginBottom: 12,
  },
  textWrap: { flex: 1, paddingRight: 12 },
  label: { fontFamily: OB.sansSemi, fontSize: 16, letterSpacing: 0.1 },
  hint: { fontFamily: OB.sans, fontSize: 13, color: OB.textDim, marginTop: 3 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: OB.onAccent, fontSize: 13, fontFamily: OB.sansBold },
});
