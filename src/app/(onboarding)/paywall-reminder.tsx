/**
 * Paywall 2/3 — reassure before the trial: we'll warn you before it ends. This
 * is the natural place to actually schedule that reminder (and ask for the
 * notification permission it needs), so Continue does it before advancing.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import { PaywallShell } from '@/components/onboarding/paywall-shell';
import { PRICING } from '@/onboarding/pricing';
import { scheduleTrialEndReminder } from '@/onboarding/reminder';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export default function PaywallReminder() {
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (busy) return;
    setBusy(true);
    // Best-effort — never block the flow if permission is denied.
    await scheduleTrialEndReminder();
    router.push('/paywall-plans');
  };

  return (
    <PaywallShell
      title={"We'll send you a reminder\nbefore your free trial ends"}
      assurance="No Payment Due Now"
      ctaLabel={busy ? 'One sec…' : 'Continue For Free'}
      busy={busy}
      onCta={onContinue}
      belowCta={
        <Text style={styles.price}>
          Just {PRICING.yearly} per year ({PRICING.perMonth}/mo)
        </Text>
      }
    >
      <Animated.View
        entering={FadeIn.delay(120).duration(500).reduceMotion(ReduceMotion.System)}
        style={styles.bellWrap}
      >
        <Svg width={150} height={150} viewBox="0 0 24 24">
          <Path
            d="M12 2a6 6 0 0 0-6 6c0 4-1.5 5.5-2.2 6.3-.4.4-.1 1.2.5 1.2h15.4c.6 0 .9-.8.5-1.2C19.5 13.5 18 12 18 8a6 6 0 0 0-6-6Z"
            fill="#D3DBE0"
          />
          <Path d="M9.5 19a2.5 2.5 0 0 0 5 0Z" fill="#D3DBE0" />
        </Svg>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>1</Text>
        </View>
      </Animated.View>
    </PaywallShell>
  );
}

const styles = StyleSheet.create({
  bellWrap: { alignSelf: 'center', marginTop: 90, width: 150, height: 150 },
  badge: {
    position: 'absolute',
    top: 4,
    right: -4,
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 6,
    backgroundColor: '#D9534F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: OB.sansBold, fontSize: 22, color: '#FFFFFF' },
  price: { fontFamily: OB.sansMed, fontSize: 15, color: OB.text },
});
