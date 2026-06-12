import PressScale from '@/components/press-scale';
import SFIcon from '@/components/SF-icon';
import Toggle from '@/components/toggle';
import { Theme } from '@/constants/theme';
import { Alarm, Haptics } from '@/utils/alarm-store';
import { format12h } from '@/utils/time';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Swipe-to-delete geometry
const ACTION_WIDTH = 64;
const OPEN_X = -(ACTION_WIDTH + 12); // resting position when the trash is revealed
const SPRING = { damping: 20, stiffness: 240 };

interface AlarmCardProps {
  alarm: Alarm;
  theme: Theme;
  index: number;
  onToggle: () => void;
  onDelete: () => void;
}

export default function AlarmCard({
  alarm,
  theme,
  index,
  onToggle,
  onDelete,
}: AlarmCardProps) {
  const { time, period } = format12h(alarm.hour, alarm.minute);
  const dim = !alarm.enabled;

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const hapticReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pan = Gesture.Pan()
    // Only claim clearly-horizontal drags, so vertical scrolling and
    // taps on the card / toggle keep working as before.
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      let next = startX.value + e.translationX;
      if (next > 0) next = next * 0.15; // rubber-band when dragging right
      if (next < OPEN_X) next = OPEN_X + (next - OPEN_X) * 0.25; // and past open
      translateX.value = next;
    })
    .onEnd((e) => {
      const shouldOpen =
        e.velocityX < -400 || (translateX.value < OPEN_X / 2 && e.velocityX < 400);
      if (shouldOpen && startX.value === 0) runOnJS(hapticReveal)();
      translateX.value = withSpring(shouldOpen ? OPEN_X : 0, SPRING);
    });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Trash button fades + scales in as the card slides away
  const actionStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, translateX.value / OPEN_X));
    return {
      opacity: p,
      transform: [{ scale: 0.7 + 0.3 * p }],
    };
  });

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Slide the card fully off-screen, then let the store remove it.
    translateX.value = withTiming(-500, { duration: 220 });
    setTimeout(onDelete, 160);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 90)
        .springify()
        .damping(18)}
      exiting={FadeOut.duration(180)}
      layout={LinearTransition.springify().damping(18)}
      style={styles.cardContainer}
    >
      {/* Delete action — sits underneath the card, revealed by swiping left */}
      <View style={styles.actionUnderlay} pointerEvents="box-none">
        <Animated.View style={actionStyle}>
          <Pressable
            onPress={handleDelete}
            hitSlop={8}
            style={({ pressed }) => [
              styles.deleteBtn,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <SFIcon name="trash" size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={slideStyle}>
          <PressScale
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
            ]}
          >
            <View style={styles.cardTop}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text
                  style={[
                    styles.cardTime,
                    { color: dim ? theme.textFaint : theme.text },
                  ]}
                >
                  {time}
                </Text>
                <Text
                  style={[
                    styles.cardPeriod,
                    { color: dim ? theme.textFaint : theme.textDim },
                  ]}
                >
                  {' '}
                  {period}
                </Text>
              </View>
              {/* Spacer to hold the layout space for the toggle positioned on top */}
              <View style={{ width: 46 }} />
            </View>

            <Text
              style={[styles.cardLabel, { color: dim ? theme.textFaint : theme.textDim }]}
              numberOfLines={1}
            >
              {alarm.label}
            </Text>

            <View style={styles.cardBottom}>
              {/* Challenge chip — what it costs to silence this one */}
              <View
                style={[
                  styles.chip,
                  { backgroundColor: dim ? 'transparent' : theme.chipBg },
                  dim && { borderWidth: 1, borderColor: theme.surfaceBorder },
                ]}
              >
                <Text
                  style={[
                    styles.chipGlyph,
                    { color: dim ? theme.textFaint : theme.chipText },
                  ]}
                >
                  {alarm.challenge.glyph}
                </Text>
                <Text
                  style={[
                    styles.chipText,
                    { color: dim ? theme.textFaint : theme.chipText },
                  ]}
                >
                  {alarm.challenge.label}
                </Text>
              </View>

              <View style={styles.daysRow}>
                {DAY_LETTERS.map((letter, i) => {
                  const active = alarm.days.includes(i);
                  return (
                    <Text
                      key={`${letter}-${i}`}
                      style={[
                        styles.dayLetter,
                        {
                          color:
                            active && !dim ? theme.accentDeep : theme.textFaint,
                          fontFamily:
                            active && !dim ? 'Sora_600SemiBold' : 'Sora_400Regular',
                        },
                      ]}
                    >
                      {letter}
                    </Text>
                  );
                })}
              </View>
            </View>
          </PressScale>

          {/*
            Toggle stays absolutely positioned on top of the card (so the parent
            Pressable doesn't steal its touches) but lives inside the sliding
            view so it travels with the card during a swipe.
          */}
          <View style={styles.toggleContainer}>
            <Toggle value={alarm.enabled} onChange={onToggle} theme={theme} />
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  actionUnderlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: ACTION_WIDTH,
    height: ACTION_WIDTH,
    borderRadius: ACTION_WIDTH / 2,
    backgroundColor: '#D9534B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  toggleContainer: {
    position: 'absolute',
    top: 25, // Vertically centered with cardTop (approx. paddingVertical + offset)
    right: 20, // Horizontal padding alignment
    zIndex: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTime: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 34,
    letterSpacing: -0.5,
    paddingHorizontal: 8,
  },
  cardPeriod: {
    fontFamily: 'Sora_500Medium',
    fontSize: 12,
    letterSpacing: 1,
  },
  cardLabel: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
    gap: 6,
  },
  chipGlyph: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
  },
  chipText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  daysRow: { flexDirection: 'row', gap: 7 },
  dayLetter: { fontSize: 11 },
});