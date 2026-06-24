import SFIcon from '@/components/SF-icon';
import { ALARM_SOUNDS, previewSound, stopPreview } from '@/utils/alarm-sounds';
import { Haptics } from '@/utils/alarm-store';
import { getDefaultSoundId, setDefaultSoundId } from '@/utils/settings-store';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THEMES = {
  dark: {
    bg: '#0D0F1E',
    surface: '#171A2E',
    surfaceBorder: 'rgba(235, 238, 255, 0.07)',
    text: '#EEF0FF',
    textDim: 'rgba(238, 240, 255, 0.56)',
    textFaint: 'rgba(238, 240, 255, 0.32)',
    accent: '#FFB45C',
    accentDeep: '#FF6E50',
    chipBg: 'rgba(255, 180, 92, 0.13)',
    chipText: '#FFC787',
    toggleOff: 'rgba(238, 240, 255, 0.14)',
    fabText: '#1A1206',
    danger: '#FF6E6E',
  },
  light: {
    bg: '#F1F4FA',
    surface: '#FFFFFF',
    surfaceBorder: 'rgba(24, 28, 46, 0.06)',
    text: '#181C2E',
    textDim: 'rgba(24, 28, 46, 0.58)',
    textFaint: 'rgba(24, 28, 46, 0.34)',
    accent: '#F59A3E',
    accentDeep: '#F25C3C',
    chipBg: 'rgba(242, 92, 60, 0.09)',
    chipText: '#D9622E',
    toggleOff: 'rgba(24, 28, 46, 0.14)',
    fabText: '#FFFFFF',
    danger: '#E2483F',
  },
};

export default function SoundsScreen() {
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const theme = isDark ? THEMES.dark : THEMES.light;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load the current default sound on mount.
  useEffect(() => {
    let cancelled = false;
    getDefaultSoundId().then((id) => {
      if (!cancelled) setSelectedId(id);
    });
    return () => {
      cancelled = true;
      stopPreview();
    };
  }, []);

  const handlePick = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedId(id);
    await setDefaultSoundId(id);
    previewSound(id);
  };

  const handleClose = () => {
    stopPreview();
    router.dismiss();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 76, paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Alarm sound</Text>
        <Text style={[styles.subtitle, { color: theme.textFaint }]}>
          Tap to preview · pick the one that gets you up
        </Text>

        <View style={styles.list}>
          {ALARM_SOUNDS.map((sound) => {
            const active = (selectedId ?? ALARM_SOUNDS[0].id) === sound.id;
            return (
              <Pressable
                key={sound.id}
                onPress={() => handlePick(sound.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? theme.chipBg : theme.surface,
                    borderColor: active ? theme.accent : theme.surfaceBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  <SFIcon
                    name={active ? 'speaker.wave.2.fill' : 'speaker.wave.2'}
                    size={20}
                    color={active ? theme.accent : theme.textFaint}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: theme.text }]}>
                      {sound.name}
                    </Text>
                    <Text style={[styles.rowDesc, { color: theme.textFaint }]}>
                      {sound.description}
                    </Text>
                  </View>
                </View>
                {active && (
                  <SFIcon name="checkmark.circle.fill" size={22} color={theme.accent} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.doneBtn,
            { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.doneText, { color: theme.fabText }]}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 28,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  list: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderCurve: 'continuous',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    paddingRight: 10,
  },
  rowName: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  rowDesc: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  doneBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  doneText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
