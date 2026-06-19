/**
 * (onboarding) layout — wraps the whole flow in the OnboardingProvider so every
 * screen shares one typed answer object, and forces light-mode chrome. The
 * group is intentionally light-only regardless of the system colour scheme.
 */

import { OnboardingProvider } from '@/onboarding/state';
import { Colors } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: Colors.light.background },
        }}
      />
    </OnboardingProvider>
  );
}
