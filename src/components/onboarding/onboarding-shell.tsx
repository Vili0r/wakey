/**
 * onboarding-shell — the common page chrome every onboarding screen sits in.
 *
 * It forces the light palette (onboarding is light-mode only, regardless of
 * the system setting), lays out an optional back button + progress bar at the
 * top, a scrollable body, and a pinned footer with the primary sunrise CTA.
 * Screens pass their headline/eyebrow and body content; the shell keeps the
 * typography and spacing consistent with the rest of the app.
 */

import { Colors, Fonts } from '@/constants/theme';
import { Haptics } from '@/utils/alarm-store';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const C = Colors.light;

/** Light-only palette + type tokens, exported so screens stay consistent. */
export const OB = {
  bg: C.background,
  surface: C.backgroundElement,
  text: C.text,
  textDim: C.textDim,
  textFaint: C.textFaint,
  accent: C.accent,
  accentDeep: C.accentDeep,
  accentSoft: C.accentSoft,
  accentText: C.accentText,
  onAccent: C.onAccent,
  border: C.border,
  serif: 'InstrumentSerif_400Regular_Italic',
  sans: 'Sora_400Regular',
  sansMed: 'Sora_500Medium',
  sansSemi: 'Sora_600SemiBold',
  sansBold: 'Sora_700Bold',
  mono: 'SpaceMono_400Regular',
  gradient: [C.accent, C.accentDeep] as const,
} as const;

type OnboardingShellProps = {
  children: ReactNode;
  /** Small-caps label above the title. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** 0–1 progress; omit to hide the bar (e.g. welcome screen). */
  progress?: number;
  showBack?: boolean;
  /** Primary CTA. Omit to render a screen with no footer button. */
  ctaLabel?: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
  /** Small line of reassurance under the CTA (e.g. legal / trial copy). */
  footnote?: ReactNode;
  /** Centre the body content vertically (reveal / stat screens). */
  center?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function OnboardingShell({
  children,
  eyebrow,
  title,
  subtitle,
  progress,
  showBack = false,
  ctaLabel,
  onCta,
  ctaDisabled = false,
  footnote,
  center = false,
  contentStyle,
}: OnboardingShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {(showBack || progress !== undefined) && (
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
              style={[styles.backBtn, styles.backBtnActive]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24">
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
          {progress !== undefined && <ProgressBar progress={progress} />}
          <View style={styles.backBtn} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          center && styles.scrollCenter,
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {(eyebrow || title || subtitle) && (
          <Animated.View
            entering={FadeInDown.duration(420).reduceMotion(ReduceMotion.System)}
            style={styles.header}
          >
            {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </Animated.View>
        )}
        {children}
      </ScrollView>

      {ctaLabel && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {footnote && <View style={styles.footnote}>{footnote}</View>}
          <OnboardingButton label={ctaLabel} onPress={onCta} disabled={ctaDisabled} />
        </View>
      )}
    </View>
  );
}

/** The primary sunrise-gradient pill CTA used across onboarding. */
export function OnboardingButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.92 : 1 }]}
    >
      <LinearGradient
        colors={OB.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Thin sunrise-gradient progress bar. */
export function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
    >
      <LinearGradient
        colors={OB.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressFill, { width: `${clamped * 100}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OB.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    height: 40,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backBtnActive: {
    backgroundColor: OB.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OB.border,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(24, 28, 46, 0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  scroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24, flexGrow: 1 },
  scrollCenter: { justifyContent: 'center' },
  header: { marginBottom: 18 },
  eyebrow: {
    fontFamily: OB.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: OB.accentText,
    marginBottom: 10,
  },
  title: {
    fontFamily: OB.serif,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.5,
    color: OB.text,
  },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 22,
    color: OB.textDim,
    marginTop: 12,
  },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  footnote: { marginBottom: 12, alignItems: 'center' },
  cta: {
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: OB.sansBold,
    fontSize: 17,
    color: OB.onAccent,
    letterSpacing: 0.2,
  },
});
