/**
 * paywall-shell — shared chrome for the three-step paywall. Unlike the survey
 * OnboardingShell, this drops the progress bar, leads with a bold sans headline,
 * and pins a black CTA footer with an assurance line above and free-form copy
 * below (legal links, price, "View all plans"). Light-mode only.
 */

import { OB } from '@/components/onboarding/onboarding-shell';
import { Haptics } from '@/utils/alarm-store';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

export function PaywallShell({
  title,
  subtitle,
  children,
  assurance,
  ctaLabel,
  onCta,
  busy = false,
  belowCta,
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Small reassurance line shown with a check above the CTA. */
  assurance?: string;
  ctaLabel: string;
  onCta: () => void;
  busy?: boolean;
  /** Free-form copy under the button (price, legal, secondary action). */
  belowCta?: ReactNode;
  showBack?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        {showBack ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (router.canGoBack()) router.back();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M15 19L8 12L15 5"
                stroke={OB.text}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {assurance ? (
          <View style={styles.assuranceRow}>
            <Text style={styles.assuranceCheck}>✓</Text>
            <Text style={styles.assuranceText}>{assurance}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => {
            if (busy) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onCta();
          }}
          style={({ pressed }) => [styles.cta, { opacity: busy ? 0.55 : pressed ? 0.9 : 1 }]}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>

        {belowCta ? <View style={styles.belowCta}>{belowCta}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OB.bg },
  topBar: { height: 40, paddingHorizontal: 20, justifyContent: 'center' },
  backBtn: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  title: {
    fontFamily: OB.sansBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
    color: OB.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 16,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 12,
  },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  assuranceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  assuranceCheck: { fontFamily: OB.sansBold, fontSize: 15, color: OB.text },
  assuranceText: { fontFamily: OB.sansBold, fontSize: 16, color: OB.text },
  cta: {
    height: 60,
    borderRadius: 30,
    backgroundColor: OB.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: OB.sansBold, fontSize: 18, color: '#FFFFFF', letterSpacing: 0.2 },
  belowCta: { alignItems: 'center', marginTop: 12 },
});
