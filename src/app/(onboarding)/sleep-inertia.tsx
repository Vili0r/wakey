
import { OB, OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

const BARS = [
  0.08, 0.1, 0.12, 0.22, 0.32, 0.45, 0.6, 0.75, 0.9, 1.0, 1.05, 1.0, 0.9, 0.75, 0.6, 0.45, 0.32, 0.22, 0.12, 0.1, 0.08
];

const YELLOW_INDEX = 17;
const GREEN_INDEX = 3;

export default function SleepInertia() {
  const [step, setStep] = useState(1);

  const handleCta = () => {
    if (step === 1) {
      setStep(2);
    } else {
      router.push('/demo-intro');
    }
  };

  const ctaLabel = step === 1 ? "Continue" : "Show me the solution";

  // Light mode friendly colors
  const defaultBarColor = 'rgba(24, 28, 46, 0.08)';
  const yellowColor = '#FFC107'; 
  const greenColor = '#34C759';  

  return (
    <OnboardingShell
      progress={0.6}
      showBack
      center
      ctaLabel={ctaLabel}
      onCta={handleCta}
    >
      <View style={styles.body}>
        <Animated.View 
          entering={FadeInDown.duration(420).reduceMotion(ReduceMotion.System)}
          style={styles.header}
        >
          <Text style={styles.eyebrow}>Based on user research</Text>
          {step === 1 && (
            <Text style={styles.title}>You take longer to get up than 89% of people</Text>
          )}
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(100).duration(480).reduceMotion(ReduceMotion.System)}
          style={styles.subtitle}
        >
          {step === 1 && (
            <>
            {'\n'}It seems waking up is a real struggle for you.
            </>
          )}
          {step === 2 && (
            <Animated.Text entering={FadeIn.duration(400)} style={styles.title}>
              {'\n'}But don't worry! Wakey will help you reach this goal.
            </Animated.Text>
          )}
        </Animated.Text>

        <Animated.View
          entering={FadeIn.duration(600).reduceMotion(ReduceMotion.System)}
          style={styles.chartContainer}
        >
          <View style={styles.chart}>
            {BARS.map((height, i) => {
              const isYellow = i === YELLOW_INDEX;
              const isGreen = step === 2 && i === GREEN_INDEX;
              const color = isYellow ? yellowColor : isGreen ? greenColor : defaultBarColor;
              
              return (
                <View key={i} style={styles.barColumn}>
                  {/* Pointer */}
                  <View style={styles.pointerContainer}>
                    {isYellow && (
                      <View style={[styles.triangleDown, { borderTopColor: yellowColor }]} />
                    )}
                    {isGreen && (
                      <Animated.View entering={FadeInDown.duration(400)} style={[styles.triangleDown, { borderTopColor: greenColor }]} />
                    )}
                  </View>
                  
                  {/* Bar */}
                  {isGreen ? (
                    <Animated.View entering={FadeIn.duration(400)} style={[styles.bar, { height: height * 90, backgroundColor: color }]} />
                  ) : (
                    <View style={[styles.bar, { height: height * 90, backgroundColor: color }]} />
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.labels}>
            <Text style={styles.label}>Early Bird</Text>
            <Text style={styles.label}>Heavy Sleeper</Text>
          </View>
        </Animated.View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: OB.sans,
    fontSize: 13,
    color: OB.textDim,
    marginBottom: 8,
  },
  title: {
    fontFamily: OB.sansBold,
    fontSize: 26,
    lineHeight: 34,
    color: OB.text,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  subtitle: {
    fontFamily: OB.sans,
    fontSize: 16,
    lineHeight: 24,
    color: OB.textDim,
    textAlign: 'center',
    marginBottom: 48,
  },
  subtitleBold: {
    fontFamily: OB.sansBold,
    color: OB.text,
  },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    gap: 4,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 8,
  },
  bar: {
    width: 8,
    borderRadius: 2,
  },
  pointerContainer: {
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  triangleDown: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 250,
    marginTop: 16,
  },
  label: {
    fontFamily: OB.sans,
    fontSize: 12,
    color: OB.textDim,
  },
});
