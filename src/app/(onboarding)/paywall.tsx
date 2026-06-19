/**
 * Screen 20 — placeholder paywall and the flow's exit. The only hard
 * requirement here is scheduling the trial-end reminder; the rest is stand-in
 * UI. Starting the trial persists onboarding (flag + wake time + answers),
 * seeds the first alarm, schedules the reminder, then routes into the app.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { completeOnboarding } from '@/onboarding/persistence';
import { TRIAL_DAYS, scheduleTrialEndReminder } from '@/onboarding/reminder';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

const PLAN_ROWS: { title: string; sub: string }[] = [
  { title: `${TRIAL_DAYS} days free`, sub: 'Full access from the first morning' },
  { title: 'Then $3.99 / month', sub: 'Billed monthly · placeholder price' },
  { title: 'Cancel anytime', sub: 'We remind you before the trial ends' },
];

export default function Paywall() {
  const { state } = useOnboarding();
  const [busy, setBusy] = useState(false);

  const startTrial = async () => {
    if (busy) return;
    setBusy(true);
    // Reminder is the one paywall must-have; schedule it first.
    await scheduleTrialEndReminder();
    await completeOnboarding(state);
    router.replace('/(tabs)/home');
  };

  return (
    <OnboardingShell
      progress={1}
      showBack
      eyebrow="START FREE"
      title="Your mornings, starting tomorrow."
      subtitle="You’ve set your time, made your pledge, and felt the loop. Begin the free trial and your first alarm is ready to go."
      ctaLabel={busy ? 'Setting up…' : `Start my ${TRIAL_DAYS}-day free trial`}
      ctaDisabled={busy}
      onCta={startTrial}
      footnote={
        <Text style={styles.footnote}>
          No charge today · We’ll remind you 1 day before it ends
        </Text>
      }
    >
      <View style={styles.card}>
        {PLAN_ROWS.map((row, i) => (
          <View key={row.title} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Text style={styles.tick}>✓</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator color={OB.accentDeep} />
          <Text style={styles.busyText}>Building your first alarm…</Text>
        </View>
      )}

      <View style={styles.legalRow}>
        <Pressable hitSlop={8}>
          <Text style={styles.legal}>Restore</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable hitSlop={8}>
          <Text style={styles.legal}>Terms</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable hitSlop={8}>
          <Text style={styles.legal}>Privacy</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>Placeholder paywall — wire real billing later.</Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  footnote: { fontFamily: OB.sans, fontSize: 12.5, color: OB.textDim, textAlign: 'center' },
  card: {
    backgroundColor: OB.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OB.border,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: OB.border },
  tick: { fontFamily: OB.sansBold, fontSize: 16, color: OB.accentDeep, width: 28 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: OB.sansSemi, fontSize: 16, color: OB.text },
  rowSub: { fontFamily: OB.sans, fontSize: 13, color: OB.textDim, marginTop: 2 },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 18 },
  busyText: { fontFamily: OB.sansMed, fontSize: 13, color: OB.textDim },
  legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  legal: { fontFamily: OB.sansMed, fontSize: 12.5, color: OB.textDim },
  legalDot: { color: OB.textFaint },
  note: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 14,
  },
});
