import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { StatReveal } from '@/components/onboarding/stat-reveal';
import { snoozeStat } from '@/onboarding/questions';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeInDown, ReduceMotion } from 'react-native-reanimated';

function Card({ value, label, highlight, delay }: { value: string, label: string, highlight?: boolean, delay: number }) {
  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).duration(400).springify().damping(20).reduceMotion(ReduceMotion.System)}
      style={styles.card}
    >
      <Text style={[styles.cardValue, highlight && styles.cardValueHighlight]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function RevealStat() {
  const { state } = useOnboarding();
  const stat = snoozeStat(state.snooze);

  const zero = stat.snoozesPerDay === 0;

  const minutesPerDay = stat.minutesPerDay; 
  const hoursPerWeek = (minutesPerDay * 7) / 60;
  const hoursPerMonth = (minutesPerDay * 30) / 60;
  const hoursPerYear = hoursPerMonth * 12;

  const format = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1);
  const formatMonth = (n: number) => n.toFixed(1); 

  return (
    <OnboardingShell
      progress={0.48}
      center={zero}
      ctaLabel={zero ? 'Keep it that way' : 'Continue'}
      onCta={() => router.push('/q-hardest')}
    >
      {zero ? (
        <StatReveal value="0" unit="MORNINGS WASTED" lead="You said you don’t snooze.">
          <Text style={styles.zeroBody}>
            Rare — and worth protecting. Wakey makes sure one rough night never
            turns into a snooze habit.
          </Text>
        </StatReveal>
      ) : (
        <View style={styles.container}>
          <Animated.View entering={FadeInDown.duration(420).reduceMotion(ReduceMotion.System)} style={styles.header}>
            <Text style={styles.title}>The time you're losing</Text>
            <Text style={styles.subtitle}>If you keep going like this, you'll lose:</Text>
          </Animated.View>

          <View style={styles.cards}>
            <Card 
              value={`${minutesPerDay} min`} 
              label="every day" 
              delay={100} 
            />
            <Card 
              value={`${format(hoursPerWeek)} hrs`} 
              label="every week" 
              delay={200} 
            />
            <Card 
              value={`${formatMonth(hoursPerMonth)} hrs`} 
              label="every month" 
              delay={300} 
            />
            <Card 
              value={`${Math.round(hoursPerYear)} hrs`} 
              label="every year" 
              highlight 
              delay={400} 
            />
          </View>
        </View>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingTop: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: OB.serif,
    fontSize: 36,
    color: OB.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 15,
    color: OB.textDim,
    textAlign: 'center',
  },
  cards: {
    gap: 12,
  },
  card: {
    backgroundColor: OB.surface,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardValue: {
    fontFamily: OB.sansBold,
    fontSize: 32,
    color: OB.text,
    marginBottom: 4,
  },
  cardValueHighlight: {
    color: '#FFA000', // Matches the bright orange/yellow in the image
  },
  cardLabel: {
    fontFamily: OB.sans,
    fontSize: 14,
    color: OB.textDim,
  },
  zeroBody: {
    fontFamily: OB.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: OB.textDim,
    textAlign: 'center',
  },
});
