import { OB } from '@/components/onboarding/onboarding-shell';
import { PaywallShell } from '@/components/onboarding/paywall-shell';
import { completeOnboarding } from '@/onboarding/persistence';
import { PRICING } from '@/onboarding/pricing';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Purchases from 'react-native-purchases';

// Placeholder clip — swap for a real Wakey screen-capture (local require or URL).
const DEMO_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const LEGAL = ['Privacy Policy', 'Restore Purchase', 'Terms of Use'];

export default function Paywall() {
  const { state } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  const { width } = useWindowDimensions();
  const frameW = Math.min(width * 0.62, 230);
  const frameH = frameW * 2.1;

  const handleRestorePurchases = async () => {
    setIsLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['Wakey Pro']) {
        Alert.alert('Success', 'Your purchase has been restored.');
        await completeOnboarding(state);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        Alert.alert('Notice', 'No active subscription found to restore.');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to restore purchases.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const player = useVideoPlayer(DEMO_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <PaywallShell
      title="Try Wakey for free."
      assurance="No Payment Due Now"
      ctaLabel={PRICING.trialCta}
      onCta={() => router.push('/paywall-reminder')}
      belowCta={
        <>
          <Text style={styles.subNote}>No commitment, cancel anytime.</Text>
          <View style={styles.legalRow}>
            {LEGAL.map((label, i) => (
              <View key={label} style={styles.legalItem}>
                {i > 0 && <Text style={styles.legalDot}>•</Text>}
                <Pressable
                  hitSlop={6}
                  disabled={label === 'Restore Purchase' ? isLoading : false}
                  onPress={() => {
                    if (label === 'Restore Purchase') {
                      handleRestorePurchases();
                    } else if (label === 'Privacy Policy') {
                      WebBrowser.openBrowserAsync('https://www.memonotes.app/privacy');
                    } else if (label === 'Terms of Use') {
                      WebBrowser.openBrowserAsync('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
                    }
                  }}
                >
                  <Text style={styles.legal}>
                    {label === 'Restore Purchase' && isLoading ? 'Restoring...' : label}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      }
    >
      <View style={styles.frameWrap}>
        <View style={[styles.frame, { width: frameW, height: frameH }]}>
          <View style={styles.screen}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          </View>
          <View style={styles.island} />
        </View>
      </View>
    </PaywallShell>
  );
}

const styles = StyleSheet.create({
  frameWrap: { alignItems: 'center', marginTop: 28, marginBottom: 12 },
  frame: {
    backgroundColor: '#0D0D0F',
    borderRadius: 42,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  screen: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  island: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    width: 78,
    height: 24,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  subNote: { fontFamily: OB.sansMed, fontSize: 14.5, color: OB.text },
  legalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  legalItem: { flexDirection: 'row', alignItems: 'center' },
  legal: { fontFamily: OB.sansMed, fontSize: 13, color: OB.textDim, textDecorationLine: 'underline' },
  legalDot: { color: OB.textFaint, marginHorizontal: 8 },
});
