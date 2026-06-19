/**
 * reflect-card — plays the user's own answers back to them so the flow feels
 * heard. Renders a "from → to" card: where they are now (their answers) versus
 * the morning Wakey is building toward. Presentational; the screen maps answer
 * ids to phrases.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

export type ReflectRow = { from: string; to: string };

export function ReflectCard({ rows }: { rows: ReflectRow[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.colLabel}>TODAY</Text>
        <Text style={[styles.colLabel, styles.colLabelTo]}>WITH WAKEY</Text>
      </View>
      {rows.map((row, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(120 + i * 120)
            .duration(460)
            .reduceMotion(ReduceMotion.System)}
          style={[styles.row, i > 0 && styles.rowBorder]}
        >
          <Text style={styles.from}>{row.from}</Text>
          <Text style={styles.arrow}>→</Text>
          <Text style={styles.to}>{row.to}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: OB.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OB.border,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  colLabel: { fontFamily: OB.mono, fontSize: 10, letterSpacing: 1.8, color: OB.textFaint },
  colLabelTo: { color: OB.accentText },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: OB.border },
  from: { flex: 1, fontFamily: OB.sansMed, fontSize: 14, color: OB.textDim },
  arrow: { fontFamily: OB.sansSemi, fontSize: 16, color: OB.accent, paddingHorizontal: 10 },
  to: { flex: 1, fontFamily: OB.sansSemi, fontSize: 14, color: OB.text, textAlign: 'right' },
});
