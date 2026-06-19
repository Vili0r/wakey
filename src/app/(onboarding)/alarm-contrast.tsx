/**
 * Screen 7 — the payoff of their choices, drawn as a contrast. Now that they've
 * set a time and a mission, replay both back: the old snooze spiral that ends
 * late, versus one mission that hands the morning back. Personalised with their
 * real alarm time so it reads as "your tomorrow", not a generic pitch.
 */

import { CHALLENGES } from '@/app/(tabs)/home/challenge';
import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

const TOP = 32; // y of the first node centre
const GAP = 72; // vertical spacing between nodes
const R = 20; // node radius
const LINE_X = R + 8; // x of the rail / node centres
const CARD_H = TOP + GAP * 3 + R + 26;

const cy = (i: number) => TOP + i * GAP;

type Node = { time: string; label: string; icon: string; filled?: boolean };

function TimelineCard({
  title,
  titleColor,
  highlight,
  nodes,
  lineColor,
  dashed,
  badge,
}: {
  title: string;
  titleColor: string;
  highlight?: boolean;
  nodes: Node[];
  lineColor: string;
  dashed?: boolean;
  /** Accent payoff pill shown level with the other column's last node. */
  badge?: string;
}) {
  const lastIdx = nodes.length - 1;
  return (
    <View
      style={[
        styles.card,
        highlight ? styles.cardHighlight : styles.cardPlain,
      ]}
    >
      <Text style={[styles.colHead, { color: titleColor }]}>{title}</Text>

      <View style={{ height: CARD_H }}>
        <Svg width="100%" height={CARD_H} style={StyleSheet.absoluteFill}>
          <Line
            x1={LINE_X}
            y1={cy(0)}
            x2={LINE_X}
            y2={cy(lastIdx)}
            stroke={lineColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={dashed ? '1 7' : undefined}
          />
          {badge && (
            // faint continuation down to the reclaimed-time pill
            <Line
              x1={LINE_X}
              y1={cy(lastIdx)}
              x2={LINE_X}
              y2={cy(3) - 4}
              stroke={lineColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="1 7"
              opacity={0.5}
            />
          )}
        </Svg>

        {nodes.map((n, i) => (
          <View key={i}>
            <View
              style={[
                styles.node,
                { top: cy(i) - R, left: LINE_X - R },
                n.filled
                  ? { backgroundColor: OB.accent }
                  : highlight
                    ? styles.nodeWakey
                    : styles.nodeTypical,
              ]}
            >
              <Text style={[styles.nodeIcon, n.filled && styles.nodeIconFilled]}>{n.icon}</Text>
            </View>
            <View style={[styles.rowText, { top: cy(i) - 18 }]}>
              <Text style={styles.time}>{n.time}</Text>
              <Text style={styles.label} numberOfLines={2}>
                {n.label}
              </Text>
            </View>
          </View>
        ))}

        {badge && (
          <View style={[styles.badge, { top: cy(3) - 16 }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function AlarmContrast() {
  const { state } = useOnboarding();

  const baseTotal = state.wakeHour * 60 + state.wakeMinute;
  const at = (off: number) => {
    const t = baseTotal + off;
    const h = Math.floor(t / 60) % 24;
    const m = ((t % 60) + 60) % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, '0')}`;
  };

  const missionName =
    CHALLENGES.find((c) => c.id === state.mission)?.name ?? 'Mission';

  const typical: Node[] = [
    { time: at(0), label: 'Alarm', icon: '🔔' },
    { time: at(9), label: 'Snooze', icon: '💤' },
    { time: at(18), label: 'Snooze', icon: '💤' },
    { time: at(27), label: 'Running late', icon: '⏰' },
  ];
  const wakey: Node[] = [
    { time: at(0), label: 'Alarm', icon: '🔔' },
    { time: at(1), label: missionName, icon: '✓', filled: true },
    { time: at(2), label: 'Up for good', icon: '☀️' },
  ];

  return (
    <OnboardingShell
      progress={0.34}
      showBack
      eyebrow="STARTING TOMORROW"
      title="Same alarm. Different ending."
      subtitle={`Your ${at(0)} alarm, two ways. The mission is the fork in the road.`}
      ctaLabel="That’s the one I want"
      onCta={() => router.push('/q-mornings')}
    >
      <Animated.View
        entering={FadeInDown.delay(120).duration(500).reduceMotion(ReduceMotion.System)}
        style={styles.row}
      >
        <TimelineCard
          title="WITHOUT WAKEY"
          titleColor={OB.textFaint}
          nodes={typical}
          lineColor="#D6D6DB"
          dashed
        />
        <TimelineCard
          title="WITH WAKEY"
          titleColor={OB.accentText}
          highlight
          nodes={wakey}
          lineColor={OB.accent}
          badge="+25 min back"
        />
      </Animated.View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  card: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  cardPlain: { backgroundColor: OB.surface, borderColor: OB.border },
  cardHighlight: { backgroundColor: OB.accentSoft, borderColor: OB.accent },
  colHead: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 14,
    paddingLeft: 2,
  },
  node: {
    position: 'absolute',
    width: R * 2,
    height: R * 2,
    borderRadius: R,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTypical: { backgroundColor: '#F1F1F4' },
  nodeWakey: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: OB.accent,
    shadowColor: OB.accentDeep,
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  nodeIcon: { fontSize: 16 },
  nodeIconFilled: { color: '#FFFFFF', fontFamily: OB.sansBold, fontSize: 14 },
  rowText: { position: 'absolute', left: LINE_X + R + 10 },
  time: { fontFamily: OB.sansBold, fontSize: 15.5, color: OB.text, letterSpacing: 0.3 },
  label: { fontFamily: OB.sans, fontSize: 12, color: OB.textDim, marginTop: 1 },
  badge: {
    position: 'absolute',
    left: LINE_X - R,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OB.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontFamily: OB.sansBold, fontSize: 12.5, color: OB.onAccent, letterSpacing: 0.2 },
});
