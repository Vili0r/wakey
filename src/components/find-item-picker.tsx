import { useState } from 'react';
import SFIcon from '@/components/SF-icon';
import { FIND_ITEM_GRID } from '@/constants/find-item-items';
import { Haptics } from '@/utils/alarm-store';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** Only the theme tokens this sheet reads — works with any screen's theme object. */
type FindItemPickerTheme = {
  bg: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textFaint: string;
  accent: string;
  chipBg: string;
  fabText: string;
};

/**
 * Multi-select sheet for the "Find an item" challenge. The user marks which
 * items they actually have at home; at alarm time one is picked from this set
 * (and they can reroll to change it). At least one item must stay selected.
 */
export default function FindItemPicker({
  visible,
  selectedIds,
  onChange,
  onClose,
  theme,
}: {
  visible: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  theme: FindItemPickerTheme;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const itemWidth = containerWidth > 0 ? (containerWidth - 20) / 3 - 0.5 : '31%';

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return; // keep at least one
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.surfaceBorder }]}
          onPress={() => {}}
        >
          <View style={styles.grabber}>
            <View style={[styles.grabberBar, { backgroundColor: theme.surfaceBorder }]} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Items at home</Text>
          <Text style={[styles.subtitle, { color: theme.textFaint }]}>
            Keep the ones you actually have. At wake-up we’ll pick one to hunt for.
          </Text>

          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
          >
            {FIND_ITEM_GRID.map((item) => {
              const active = selectedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    {
                      width: itemWidth,
                      backgroundColor: active ? theme.chipBg : theme.surface,
                      borderColor: active ? theme.accent : theme.surfaceBorder,
                      opacity: pressed ? 0.85 : active ? 1 : 0.55,
                    },
                  ]}
                >
                  <Text style={styles.gridEmoji}>{item.emoji}</Text>
                  <Text style={[styles.gridName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View
                    style={[
                      styles.check,
                      {
                        backgroundColor: active ? theme.accent : 'transparent',
                        borderColor: active ? theme.accent : theme.textFaint,
                      },
                    ]}
                  >
                    {active && <SFIcon name="checkmark" size={10} color={theme.fabText} weight="bold" />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.doneText, { color: theme.fabText }]}>
              Done · {selectedIds.length} selected
            </Text>
          </Pressable>
        </Pressable>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
    paddingBottom: 8,
  },
  gridItem: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderCurve: 'continuous',
  },
  gridEmoji: { fontSize: 26 },
  gridName: { fontFamily: 'Sora_500Medium', fontSize: 12 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  doneBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  doneText: { fontFamily: 'Sora_600SemiBold', fontSize: 15, letterSpacing: 0.3 },
});
