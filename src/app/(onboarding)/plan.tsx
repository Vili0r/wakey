/**
 * Plan — the reveal after the setup loader. Plays the user's real choices back
 * as a concrete morning: their wake time, their mission, and a live countdown to
 * the first alarm, so the value feels already-built before the paywall asks for
 * anything. The sun is a hand-drawn SVG so it matches the sunrise palette.
 */

import { CHALLENGES } from '@/app/(tabs)/home/challenge';
import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { useOnboarding } from '@/onboarding/state';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';

const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Next weekday (Mon–Fri) occurrence of hh:mm, starting from now. */
function nextAlarm(hour: number, minute: number): Date {
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(hour, minute, 0, 0);
    const dow = d.getDay();
    if (d > now && dow >= 1 && dow <= 5) return d;
  }
  return now;
}

function fmt12(hour: number, minute: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  const period = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

function SunGraphic({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgGrad id="sun" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={OB.accent} />
          <Stop offset="1" stopColor={OB.accentDeep} />
        </SvgGrad>
      </Defs>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const inner = 30;
        const outer = 44;
        return (
          <Line
            key={i}
            x1={60 + Math.cos(a) * inner}
            y1={60 + Math.sin(a) * inner}
            x2={60 + Math.cos(a) * outer}
            y2={60 + Math.sin(a) * outer}
            stroke="url(#sun)"
            strokeWidth={5}
            strokeLinecap="round"
          />
        );
      })}
      <Circle cx={60} cy={60} r={24} fill="url(#sun)" />
      {/* face */}
      <Circle cx={52} cy={57} r={2.6} fill="#FFFFFF" />
      <Circle cx={68} cy={57} r={2.6} fill="#FFFFFF" />
      <Path d="M52 65 Q60 72 68 65" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export default function Plan() {
  const { state } = useOnboarding();
  const mission = CHALLENGES.find((c) => c.id === state.mission);
  const missionName = mission?.name ?? 'Mission';

  const target = useMemo(() => nextAlarm(state.wakeHour, state.wakeMinute), [state.wakeHour, state.wakeMinute]);
  const time = fmt12(state.wakeHour, state.wakeMinute);
  const weekdayLong = DAYS_LONG[target.getDay()];
  const weekdayShort = DAYS_SHORT[target.getDay()];

  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      const s = Math.floor(diff / 1000);
      setRemaining(`${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const timeline = [
    { icon: '🔔', text: `${time} — Alarm rings`, accent: false },
    { icon: mission?.glyph ?? '✓', text: `Complete ${missionName}`, accent: false },
    { icon: '✓', text: 'You’re up. Day started.', accent: true },
  ];

  return (
    <OnboardingShell
      progress={0.995}
      showBack
      ctaLabel="Continue"
      onCta={() => router.push('/paywall')}
    >
      <Animated.View
        entering={FadeIn.duration(500).reduceMotion(ReduceMotion.System)}
        style={styles.hero}
      >
        <SunGraphic />
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(120).duration(460).reduceMotion(ReduceMotion.System)}
        style={styles.title}
      >
        Your Morning Plan
      </Animated.Text>
      <Text style={styles.subtitle}>
        Here’s what {weekdayLong} looks like at {time}.
      </Text>

      <View style={styles.chips}>
        <Chip icon="🕐" label={`Starts in ${remaining}`} />
        <Chip icon="⚡" label={`${weekdayShort} ${time}`} />
        <Chip icon={mission?.glyph ?? '✓'} label={missionName} />
        <Chip icon="🔔" label="Default" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHead}>HERE’S {weekdayLong.toUpperCase()}</Text>
        {timeline.map((step, i) => (
          <View key={i} style={styles.tlRow}>
            <View style={styles.tlIconCol}>
              <View
                style={[
                  styles.tlIcon,
                  step.accent ? styles.tlIconAccent : styles.tlIconDark,
                ]}
              >
                <Text style={styles.tlIconText}>{step.icon}</Text>
              </View>
              {i < timeline.length - 1 && <View style={styles.tlLine} />}
            </View>
            <Text style={styles.tlText}>{step.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.receiptHead}>YOUR WAKE RECEIPT</Text>
      <LinearGradient
        colors={['#FBE3C2', OB.accentSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.receipt}
      >
        <View style={styles.receiptSun}>
          <SunGraphic size={76} />
        </View>
        <View style={styles.receiptText}>
          <Text style={styles.receiptTitle}>Rise & shine</Text>
          <Text style={styles.receiptSub}>A fresh proof-of-wake to share every morning you win.</Text>
        </View>
      </LinearGradient>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 6 },
  title: {
    fontFamily: OB.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
    color: OB.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 15,
    lineHeight: 22,
    color: OB.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OB.surface,
    borderWidth: 1,
    borderColor: OB.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontFamily: OB.sansMed, fontSize: 13, color: OB.text },
  card: {
    backgroundColor: OB.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 20,
    marginTop: 22,
  },
  cardHead: {
    fontFamily: OB.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: OB.textFaint,
    marginBottom: 16,
  },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tlIconCol: { alignItems: 'center', marginRight: 14 },
  tlIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlIconDark: { backgroundColor: OB.text },
  tlIconAccent: { backgroundColor: OB.accent },
  tlIconText: { fontSize: 17, color: '#FFFFFF' },
  tlLine: { width: 2, height: 26, backgroundColor: OB.border, marginVertical: 2 },
  tlText: { flex: 1, fontFamily: OB.sansSemi, fontSize: 16, color: OB.text, paddingTop: 9 },
  receiptHead: {
    fontFamily: OB.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 26,
    marginBottom: 12,
  },
  receipt: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    overflow: 'hidden',
  },
  receiptSun: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  receiptText: { flex: 1 },
  receiptTitle: { fontFamily: OB.serif, fontSize: 26, color: OB.text },
  receiptSub: { fontFamily: OB.sans, fontSize: 13, lineHeight: 19, color: OB.textDim, marginTop: 4 },
});
