import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as ExpoHaptics from 'expo-haptics';

// Safe wrapper for environments where ExpoHaptics isn't fully linked
const Haptics = {
  impactAsync: async (style: ExpoHaptics.ImpactFeedbackStyle) => {
    try {
      await ExpoHaptics.impactAsync(style);
    } catch {
      // Haptics not available in this build
    }
  },
  notificationAsync: async (type: ExpoHaptics.NotificationFeedbackType) => {
    try {
      await ExpoHaptics.notificationAsync(type);
    } catch {
      // Haptics not available in this build
    }
  },
  ImpactFeedbackStyle: ExpoHaptics.ImpactFeedbackStyle,
  NotificationFeedbackType: ExpoHaptics.NotificationFeedbackType,
};

type Theme = {
  name: string;
  bg: string;
  bgEdge: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentDeep: string;
  arcTrack: string;
  chipBg: string;
  chipText: string;
  toggleOff: string;
  fabText: string;
  horizon: string;
};

type Challenge = { glyph: string; label: string };

const CHALLENGES: Challenge[] = [
  { glyph: '÷', label: 'SOLVE 3 EQUATIONS' },
  { glyph: '≈', label: 'SHAKE × 20' },
  { glyph: '◫', label: 'PATTERN RECALL' },
];

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type AddAlarmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (alarm: {
    hour: number;
    minute: number;
    label: string;
    days: number[];
    challenge: Challenge;
    enabled: boolean;
  }) => void;
  theme: Theme;
};

export function AddAlarmModal({ isOpen, onClose, onSave, theme }: AddAlarmModalProps) {
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);

  if (!isOpen) return null;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Convert 12h representation to 24h
    let h24 = hour;
    if (period === 'PM' && hour !== 12) {
      h24 = hour + 12;
    } else if (period === 'AM' && hour === 12) {
      h24 = 0;
    }

    onSave({
      hour: h24,
      minute,
      label: label.trim() || 'Alarm',
      days, // empty = one-time alarm, selected days = repeating
      challenge: CHALLENGES[challengeIndex],
      enabled: true,
    });
    
    // Reset form
    setHour(7);
    setMinute(0);
    setPeriod('AM');
    setLabel('');
    setDays([]);
    setChallengeIndex(0);
    onClose();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const toggleDay = (dayIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const incrementHour = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHour((h) => (h === 12 ? 1 : h + 1));
  };

  const decrementHour = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHour((h) => (h === 1 ? 12 : h - 1));
  };

  const incrementMinute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinute((m) => (m === 59 ? 0 : m + 1));
  };

  const decrementMinute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinute((m) => (m === 0 ? 59 : m - 1));
  };

  const togglePeriod = (p: 'AM' | 'PM') => {
    if (period !== p) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPeriod(p);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        />
      </Pressable>

      {/* Bottom Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetContainer}
        pointerEvents="box-none"
      >
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(150)}
          exiting={SlideOutDown.springify().damping(20).stiffness(150)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
              boxShadow: theme.name === 'dark' 
                ? '0 -8px 32px rgba(0, 0, 0, 0.4)' 
                : '0 -8px 32px rgba(24, 28, 46, 0.08)'
            },
          ]}
        >
          {/* Header Grabber */}
          <View style={[styles.grabber, { backgroundColor: theme.textFaint }]} />

          <Text style={[styles.title, { color: theme.text }]}>New Alarm</Text>

          {/* Time Picker */}
          <View style={styles.pickerContainer}>
            {/* Hour Column */}
            <View style={styles.column}>
              <Pressable style={styles.stepperButton} onPress={incrementHour}>
                <Text style={[styles.stepperIcon, { color: theme.textDim }]}>▲</Text>
              </Pressable>
              <Text style={[styles.timeText, { color: theme.text }]}>{hour}</Text>
              <Pressable style={styles.stepperButton} onPress={decrementHour}>
                <Text style={[styles.stepperIcon, { color: theme.textDim }]}>▼</Text>
              </Pressable>
            </View>

            <Text style={[styles.colon, { color: theme.textFaint }]}>:</Text>

            {/* Minute Column */}
            <View style={styles.column}>
              <Pressable style={styles.stepperButton} onPress={incrementMinute}>
                <Text style={[styles.stepperIcon, { color: theme.textDim }]}>▲</Text>
              </Pressable>
              <Text style={[styles.timeText, { color: theme.text }]}>
                {String(minute).padStart(2, '0')}
              </Text>
              <Pressable style={styles.stepperButton} onPress={decrementMinute}>
                <Text style={[styles.stepperIcon, { color: theme.textDim }]}>▼</Text>
              </Pressable>
            </View>

            {/* AM/PM Toggle */}
            <View style={[styles.periodContainer, { borderColor: theme.surfaceBorder }]}>
              <Pressable
                style={[
                  styles.periodButton,
                  period === 'AM' && { backgroundColor: theme.accent },
                ]}
                onPress={() => togglePeriod('AM')}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: period === 'AM' ? theme.fabText : theme.textDim },
                  ]}
                >
                  AM
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.periodButton,
                  period === 'PM' && { backgroundColor: theme.accent },
                ]}
                onPress={() => togglePeriod('PM')}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: period === 'PM' ? theme.fabText : theme.textDim },
                  ]}
                >
                  PM
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Label Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textFaint }]}>LABEL</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  backgroundColor: theme.bg,
                  borderColor: theme.surfaceBorder,
                },
              ]}
              placeholder="e.g. Weekday Wake-up"
              placeholderTextColor={theme.textFaint}
              value={label}
              onChangeText={setLabel}
              maxLength={25}
            />
          </View>

          {/* Days Repeater */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textFaint }]}>REPEAT</Text>
            <View style={styles.daysRow}>
              {DAY_LETTERS.map((letter, i) => {
                const active = days.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => toggleDay(i)}
                    style={[
                      styles.dayButton,
                      { borderColor: theme.surfaceBorder },
                      active && { backgroundColor: theme.chipBg, borderColor: theme.accentDeep },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: active ? theme.chipText : theme.textFaint },
                        active && { fontFamily: 'Sora_600SemiBold' },
                      ]}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Challenge Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.textFaint }]}>
              CHALLENGE TO SILENCE
            </Text>
            <View style={styles.challengesRow}>
              {CHALLENGES.map((ch, i) => {
                const active = challengeIndex === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setChallengeIndex(i);
                    }}
                    style={[
                      styles.challengeChip,
                      { backgroundColor: theme.bg, borderColor: theme.surfaceBorder },
                      active && { backgroundColor: theme.chipBg, borderColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.challengeGlyph,
                        { color: active ? theme.chipText : theme.textFaint },
                      ]}
                    >
                      {ch.glyph}
                    </Text>
                    <Text
                      style={[
                        styles.challengeText,
                        { color: active ? theme.chipText : theme.textDim },
                      ]}
                    >
                      {ch.label.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={handleClose}>
              <Text style={[styles.cancelText, { color: theme.textDim }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, { backgroundColor: theme.accent }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveText, { color: theme.fabText }]}>Create Alarm</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 14,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    opacity: 0.3,
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 16,
  },
  column: {
    alignItems: 'center',
    width: 70,
  },
  stepperButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperIcon: {
    fontSize: 14,
  },
  timeText: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 60,
    lineHeight: 66,
  },
  colon: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 54,
    marginTop: -8,
  },
  periodContainer: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginLeft: 8,
    height: 80,
    justifyContent: 'center',
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  periodText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 8,
  },
  textInput: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 11,
  },
  challengesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    gap: 6,
  },
  challengeGlyph: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
  },
  challengeText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  cancelText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  saveButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    boxShadow: '0 4px 14px rgba(255, 110, 80, 0.25)',
  },
  saveText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15.5,
    letterSpacing: 0.2,
  },
});
