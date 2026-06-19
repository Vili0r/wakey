/**
 * Screen 5 — the aha-moment anchor: pick the time you actually want to be up.
 * Stored in 24h on the shared state and later used to prefill the first alarm.
 * Reuses the app's Wheel + Segmented so it feels native to the rest of Wakey.
 */

import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import Segmented from '@/components/segmented';
import Wheel, { ITEM_H, WHEEL_PAD } from '@/components/wheel';
import { THEMES } from '@/constants/theme';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const HOURS = Array.from({ length: 12 }, (_, i) => (i === 0 ? '12' : String(i)));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

export default function QWakeTime() {
  const { state, update } = useOnboarding();

  const { hourIndex, period } = useMemo(() => {
    const h24 = state.wakeHour;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hourIndex: h12 % 12, period: h24 < 12 ? 0 : 1 };
  }, [state.wakeHour]);

  const commit = (h12Index: number, minute: number, periodIndex: number) => {
    const h12 = h12Index === 0 ? 12 : h12Index;
    let hour24: number;
    if (periodIndex === 0) hour24 = h12 === 12 ? 0 : h12;
    else hour24 = h12 === 12 ? 12 : h12 + 12;
    update({ wakeHour: hour24, wakeMinute: minute });
  };

  return (
    <OnboardingShell
      progress={0.28}
      showBack
      eyebrow="YOUR TARGET"
      title="When do you want to be up?"
      subtitle="Not when you set an alarm and snooze — the time you actually want your feet on the floor."
      ctaLabel="Lock it in"
      onCta={() => router.push('/q-mission')}
    >
      <View style={styles.pickerWrap}>
        <View style={styles.band} pointerEvents="none" />
        <View style={styles.wheels}>
          <Wheel
            values={HOURS}
            initialIndex={hourIndex}
            onChange={(i) => commit(i, state.wakeMinute, period)}
            theme={THEMES.light}
            width={72}
          />
          <Text style={styles.colon}>:</Text>
          <Wheel
            values={MINUTES}
            initialIndex={state.wakeMinute}
            onChange={(i) => commit(hourIndex, i, period)}
            theme={THEMES.light}
            width={72}
          />
        </View>
        <View style={styles.periodWrap}>
          <Segmented
            options={PERIODS}
            selectedIndex={period}
            onChange={(i) => commit(hourIndex, state.wakeMinute, i)}
            theme={THEMES.light}
            width={140}
          />
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  pickerWrap: { alignItems: 'center', marginTop: 8 },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: {
    fontFamily: OB.serif,
    fontSize: 44,
    color: OB.text,
    marginHorizontal: 2,
    marginTop: -4,
  },
  band: {
    position: 'absolute',
    top: WHEEL_PAD,
    height: ITEM_H,
    left: 24,
    right: 24,
    borderRadius: 16,
    backgroundColor: OB.accentSoft,
  },
  periodWrap: { marginTop: 20 },
});
