/**
 * ringing.tsx — DEPRECATED route.
 *
 * Alarm dismissal is now handled by ActiveAlarmOverlay rendered at the root
 * layout. This screen exists only as a safety net: if something still
 * navigates here, we immediately go back. There is no dismiss button, no
 * challenge UI, and no way to silence the alarm from this screen.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function RingingScreen() {
  // If we somehow land here, go back — the overlay handles everything.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/home');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.dark.accent} />
      <Text style={styles.text}>Loading challenge…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0C20',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
    marginTop: 16,
  },
});
