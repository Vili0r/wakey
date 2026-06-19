/**
 * Setup — the "we're building your plan" beat right before the paywall. It does
 * no real work; the counting percentage and the checklist ticking over make the
 * plan on the next screen feel personalised and earned. Auto-advances at 100%
 * and uses router.replace so Back skips the loader.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

const STEPS = [
  'Configuring your goals',
  'Setting your mission',
  'Setting alarm tone',
  'Scheduling your alarm',
  'Setting up wake receipt',
];

export default function Setup() {
  const [pct, setPct] = useState(0);
  const advanced = useRef(false);

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => (reduce ? 16 : 50)) // ms per tick
      .catch(() => 50)
      .then((tick) => {
        id = setInterval(() => {
          setPct((p) => {
            const next = Math.min(p + 2, 100);
            if (next === 100 && !advanced.current) {
              advanced.current = true;
              setTimeout(() => router.replace('/plan'), 500);
            }
            return next;
          });
        }, tick);
      });
    return () => clearInterval(id);
  }, []);

  // Each step owns a 20% slice; the active one is the first not yet complete.
  const active = Math.min(Math.floor(pct / 20), STEPS.length - 1);

  return (
    <OnboardingShell center>
      <View style={styles.body}>
        <Animated.Text
          entering={FadeIn.duration(500).reduceMotion(ReduceMotion.System)}
          style={styles.pct}
        >
          {pct}
          <Text style={styles.pctSign}>%</Text>
        </Animated.Text>

        <Text style={styles.title}>Setting everything{'\n'}up for you</Text>

        <View style={styles.track}>
          <LinearGradient
            colors={OB.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${pct}%` }]}
          />
        </View>

        <Text style={styles.status}>
          {pct >= 100 ? 'All set.' : `${STEPS[active]}…`}
        </Text>

        <View style={styles.card}>
          {STEPS.map((label, i) => {
            const done = pct >= (i + 1) * 20;
            const isActive = i === active && !done;
            return (
              <View
                key={label}
                style={[
                  styles.row,
                  i > 0 && styles.rowBorder,
                  isActive && styles.rowActive,
                ]}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    { color: done || isActive ? OB.text : OB.textFaint },
                    (done || isActive) && styles.rowLabelStrong,
                  ]}
                >
                  {label}
                </Text>
                <View
                  style={[
                    styles.check,
                    done && { backgroundColor: OB.accent, borderColor: OB.accent },
                  ]}
                >
                  {done && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  pct: { fontFamily: OB.sansBold, fontSize: 64, color: OB.text, letterSpacing: -1 },
  pctSign: { fontFamily: OB.sansBold, fontSize: 44, color: OB.text },
  title: {
    fontFamily: OB.serif,
    fontSize: 34,
    lineHeight: 38,
    color: OB.text,
    textAlign: 'center',
    marginTop: 12,
  },
  track: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(24, 28, 46, 0.08)',
    overflow: 'hidden',
    marginTop: 28,
  },
  fill: { height: '100%', borderRadius: 999 },
  status: {
    alignSelf: 'flex-start',
    fontFamily: OB.sans,
    fontSize: 14.5,
    color: OB.textDim,
    marginTop: 12,
    marginBottom: 18,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: OB.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OB.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: OB.border },
  rowActive: { backgroundColor: OB.accentSoft },
  rowLabel: { fontFamily: OB.sans, fontSize: 15.5 },
  rowLabelStrong: { fontFamily: OB.sansSemi },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: OB.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: OB.onAccent, fontSize: 13, fontFamily: OB.sansBold },
});
