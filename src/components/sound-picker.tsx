/**
 * SoundPicker — a bottom-sheet list of selectable alarm tones.
 *
 * Reads the catalogue from src/utils/alarm-sounds.ts, so adding a tone there is
 * all it takes to make it appear here. Tapping a row selects it AND plays a
 * short preview; the preview is stopped when the sheet closes. Used by both the
 * New Alarm screen (per-alarm sound) and Settings (default sound).
 */

import SFIcon from '@/components/SF-icon';
import { ALARM_SOUNDS, previewSound, stopPreview } from '@/utils/alarm-sounds';
import { Haptics } from '@/utils/alarm-store';
import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

/** Only the theme tokens this sheet reads — works with any screen's theme object. */
type SoundPickerTheme = {
  bg: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textFaint: string;
  accent: string;
  chipBg: string;
  fabText: string;
};

export default function SoundPicker({
  visible,
  selectedId,
  onSelect,
  onClose,
  theme,
}: {
  visible: boolean;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  theme: SoundPickerTheme;
}) {
  // Never leave a preview ringing once the sheet is dismissed/unmounted.
  useEffect(() => {
    if (!visible) stopPreview();
    return () => stopPreview();
  }, [visible]);

  const handleClose = () => {
    stopPreview();
    onClose();
  };

  const handlePick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(id);
    previewSound(id);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View
          entering={FadeInDown.springify().damping(22)}
          style={[
            styles.sheet,
            { backgroundColor: theme.bg, borderColor: theme.surfaceBorder },
          ]}
          // Swallow taps inside the sheet so they don't close it.
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.grabber}>
            <View style={[styles.grabberBar, { backgroundColor: theme.surfaceBorder }]} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Alarm sound</Text>
          <Text style={[styles.subtitle, { color: theme.textFaint }]}>
            Tap to preview · pick the one that gets you up
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.doneText, { color: theme.fabText }]}>Done</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
    maxHeight: '82%',
  },
  grabber: { alignItems: 'center', paddingVertical: 8 },
  grabberBar: { width: 40, height: 5, borderRadius: 3 },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 26,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Sora_400Regular',
    fontSize: 12.5,
    marginTop: 4,
    marginBottom: 14,
  },
  list: { flexGrow: 0 },
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
  rowName: { fontFamily: 'Sora_600SemiBold', fontSize: 15 },
  rowDesc: { fontFamily: 'Sora_400Regular', fontSize: 12, marginTop: 2 },
  doneBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  doneText: { fontFamily: 'Sora_600SemiBold', fontSize: 15, letterSpacing: 0.3 },
});
