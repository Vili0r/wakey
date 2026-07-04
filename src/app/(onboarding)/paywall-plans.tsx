import { OB } from '@/components/onboarding/onboarding-shell';
import { PaywallShell } from '@/components/onboarding/paywall-shell';
import { completeOnboarding } from '@/onboarding/persistence';
import { PRICING } from '@/onboarding/pricing';
import { useOnboarding } from '@/onboarding/state';
import { router } from 'expo-router';
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Purchases, {
  PurchasesOfferings
} from "react-native-purchases";

const REVIEWS: { handle: string; stars: number; quote: string }[] = [
  {
    handle: 'g.pet',
    stars: 5,
    quote: 'First alarm app I’ve never beaten by sleeping through it. I’m actually up now.',
  },
];

const Stars = ({ n }: { n: number }) => (
  <Text style={styles.stars}>{'★'.repeat(n)}</Text>
);

export default function PaywallPlans() {
  const { state } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);

  useEffect(() => {
    // Fetch packages from RevenueCat
    getOfferings();
  }, []);

  const startTrial = async () => {
    if (busy) return;
    
    if (!offerings?.current?.annual) {
      Alert.alert("Error", "Pricing plans are currently unavailable. Please try again later.");
      return;
    }

    setBusy(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(offerings.current.annual);
      if (customerInfo.entitlements.active['Wakey Pro'] !== undefined) {
        await completeOnboarding(state);
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Error", "There was an error completing your purchase.");
      }
    } finally {
      setBusy(false);
    }
  };

  async function getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (
        offerings.current !== null &&
        offerings.current.availablePackages.length !== 0
      ) {
        setOfferings(offerings);
      }
    } catch (e) {
      console.error("Error fetching offerings", e);
    }
  }

  const handleRestorePurchases = async () => {
    setIsLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['Wakey Pro']) {
        Alert.alert("Success", "Your purchase has been restored.");
        await completeOnboarding(state);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/home");
        }
      } else {
        Alert.alert("Notice", "No active subscription found to restore.");
      }
    } catch (e: any) {
      Alert.alert("Error", "Failed to restore purchases.");
      console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const openLink = (url: string) => {
    WebBrowser.openBrowserAsync(url);
  };

  const annualPackage = offerings?.current?.annual;
  const yearlyPrice = annualPackage ? annualPackage.product.priceString : PRICING.yearly;
  const perMonthPrice = annualPackage
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: annualPackage.product.currencyCode,
      }).format(annualPackage.product.price / 12)
    : PRICING.perMonth;

  const belowCta = (
    <View style={styles.linksRow}>
      <Pressable onPress={() => openLink("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}>
        <Text style={styles.linkText}>Terms</Text>
      </Pressable>
      <Text style={styles.linkDot}>•</Text>
      <Pressable onPress={() => openLink("https://www.memonotes.app/privacy")}>
        <Text style={styles.linkText}>Privacy</Text>
      </Pressable>
      <Text style={styles.linkDot}>•</Text>
      <Pressable onPress={handleRestorePurchases} disabled={isLoading}>
        <Text style={styles.linkText}>{isLoading ? 'Restoring...' : 'Restore'}</Text>
      </Pressable>
    </View>
  );

  return (
    <PaywallShell
      title={`${PRICING.trialDays} days for Free`}
      subtitle={`then ${perMonthPrice} / month (${yearlyPrice} billed yearly after trial)`}
      assurance="No Payment Now"
      ctaLabel={busy ? 'Setting up…' : 'Start your FREE trial'}
      busy={busy}
      onCta={startTrial}
      belowCta={belowCta}
    >

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reviews}
        style={styles.reviewsScroll}
      >
        {REVIEWS.map((r) => (
          <View key={r.handle} style={styles.card}>
            <Stars n={r.stars} />
            <Text style={styles.quote}>“{r.quote}”</Text>
            <Text style={styles.handle}>{r.handle}</Text>
          </View>
        ))}
      </ScrollView>
    </PaywallShell>
  );
}

const GOLD = '#F5A623';

const styles = StyleSheet.create({
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 28 },
  laurelGroup: { flexDirection: 'row', alignItems: 'center' },
  laurel: { fontSize: 40, color: OB.text },
  laurelLeft: { transform: [{ scaleX: -1 }] },
  laurelInner: { alignItems: 'center', marginHorizontal: -4 },
  laurelNum: { fontFamily: OB.sansBold, fontSize: 26, color: OB.text },
  laurelSub: { fontFamily: OB.sansMed, fontSize: 13, color: OB.text, marginTop: -2 },
  ratingCol: { alignItems: 'flex-start' },
  ratingLabel: { fontFamily: OB.sansBold, fontSize: 17, color: OB.text, letterSpacing: 0.3 },
  stars: { fontSize: 20, color: GOLD, letterSpacing: 2, marginTop: 4 },
  reviewsScroll: { marginTop: 28, marginHorizontal: -24 },
  reviews: { paddingHorizontal: 24, gap: 14, alignItems: 'flex-start' },
  card: {
    width: 290,
    backgroundColor: OB.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: OB.border,
    padding: 18,
  },
  quote: { fontFamily: OB.sansMed, fontSize: 15, lineHeight: 22, color: OB.text, marginTop: 10 },
  handle: { fontFamily: OB.sans, fontSize: 13, color: OB.textFaint, marginTop: 14 },
  note: {
    fontFamily: OB.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: OB.textFaint,
    textAlign: 'center',
    marginTop: 24,
  },
  viewAll: { fontFamily: OB.sansSemi, fontSize: 15, color: OB.text, textDecorationLine: 'underline' },
  linksRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  linkText: { fontFamily: OB.sans, fontSize: 13, color: OB.textFaint, textDecorationLine: 'underline' },
  linkDot: { fontFamily: OB.sans, fontSize: 13, color: OB.textFaint },
});
