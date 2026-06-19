/**
 * Entry / gate — this is both the onboarding welcome screen and the gate that
 * keeps onboarding from ever showing twice. On launch we read the persisted
 * `onboardingComplete` flag: if set, redirect straight to the app; otherwise
 * render the welcome and let the user start the flow. Light-mode only.
 */

import HorizonArc from '@/components/horizon-arc';
import { OB, OnboardingButton } from '@/components/onboarding/onboarding-shell';
import { THEMES } from '@/constants/theme';
import { getOnboardingComplete } from '@/onboarding/persistence';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Index() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [status, setStatus] = useState<'checking' | 'onboard' | 'done'>('checking');

  useEffect(() => {
    let cancelled = false;
    getOnboardingComplete().then((complete) => {
      if (!cancelled) setStatus(complete ? 'done' : 'onboard');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Gate: skip onboarding forever once it's been completed.
  if (status === 'done') {
    return <Redirect href="/(tabs)/home" />;
  }

  // Hold on a clean light background until we know which way to route.
  if (status === 'checking') {
    return <View style={styles.root} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="dark" />

      <View style={styles.hero}>
        <Animated.View
          entering={FadeIn.duration(700).reduceMotion(ReduceMotion.System)}
          style={styles.art}
        >
          <HorizonArc width={width - 48} progress={0.62} theme={THEMES.light} />
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(160).duration(560).reduceMotion(ReduceMotion.System)}
          style={styles.title}
        >
          Wakey
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(280).duration(560).reduceMotion(ReduceMotion.System)}
          style={styles.tagline}
        >
          The alarm you have to{'\n'}earn your way out of.
        </Animated.Text>
      </View>

      <Animated.View
        entering={FadeInDown.delay(420).duration(560).reduceMotion(ReduceMotion.System)}
        style={styles.footer}
      >
        <OnboardingButton label="Get started" onPress={() => router.push('/q-morningperson')} />
        <Text style={styles.footnote}>Free to try · No commitment</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OB.bg, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  art: { marginBottom: 28 },
  title: {
    fontFamily: OB.serif,
    fontSize: 68,
    lineHeight: 72,
    letterSpacing: -1,
    color: OB.text,
  },
  tagline: {
    fontFamily: OB.sans,
    fontSize: 17,
    lineHeight: 25,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: { gap: 14, alignSelf: 'stretch' },
  footnote: { fontFamily: OB.mono, fontSize: 11, letterSpacing: 1.6, color: OB.textFaint, textAlign: 'center' },
});
