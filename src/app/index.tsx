import { Colors } from "@/constants/theme";
import * as ExpoHaptics from "expo-haptics";

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
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function Index() {
  const slideAnim = useRef(new Animated.ValueXY({ x: 200, y: 200 })).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        damping: 15,
        stiffness: 90,
        delay: 150,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleOnboarding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Posthog capture
    router.push("/(tabs)/home");
  };

  return (
    <SafeAreaView style={styles.container}>


      <View style={styles.content}>
        {/* Phone Mockup */}
        <Animated.View 
          style={[
            styles.phoneMockup, 
            { 
              transform: slideAnim.getTranslateTransform(),
              opacity: opacityAnim,
            }
          ]}
        >          
          {/* Home indicator */}
          <View style={styles.homeIndicator} />
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Never miss{"\n"}a detail again</Text>
        </View>

        <TouchableOpacity 
          onPress={handleOnboarding} 
          style={styles.button} 
          activeOpacity={0.8}
        >
          <Animated.View 
            style={[
              styles.buttonProgress,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]} 
          />
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      
        <View style={styles.footer}>                                                                                                    
          <Text style={styles.priceFree}>Try for $0</Text>                                                                                                                                   
        </View>
      </View>
    </SafeAreaView>
  );
}

const PHONE_WIDTH = width * 0.58;
const PHONE_HEIGHT = PHONE_WIDTH * 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 5,
    alignItems: "flex-end",
  },
  languageBadge: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  languageText: {
    fontSize: 12,
    color: "#000",
    fontFamily: 'Sora_600SemiBold',
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingBottom: 20,
    paddingTop: 10,
  },
  phoneMockup: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    backgroundColor: "#1a1a1a",
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#333",
    padding: 6,
    alignItems: "center",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  phoneScreen: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 24,
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  homeIndicator: {
    width: 80,
    height: 4,
    backgroundColor: "#666",
    borderRadius: 3,
    position: "absolute",
    bottom: 6,
  },
  muteButton: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    color: "white",
    textAlign: "center",
    lineHeight: 40,
    fontFamily: 'Sora_700Bold',
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    width: "100%",
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.light.accent,
    opacity: 0.9,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontFamily: 'Sora_700Bold',
    zIndex: 10,
  },
  footer: {
    flexDirection: "row",                                                                                    
    alignItems: "center",                        
    justifyContent: "center",
    gap: 6,                                                                                           
  },                                                                                                                                                                                                                                                                                                                                                                                                                                   
  priceFree: {                                                                                        
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 18,
    fontFamily: 'Sora_400Regular',
  },               
});
