import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { db } from '@/db/db';
import { seedInitialAlarmsIfEmpty } from '@/utils/alarm-store';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { requireOptionalNativeModule } from 'expo';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import migrations from '../../drizzle/migrations';

export const DATABASE_NAME = 'wakey';

const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences');
DevMenuPreferences?.setPreferencesAsync({
  showFloatingActionButton: false,
  showsAtLaunch: false,
}).catch(() => {});


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Prevent errors if called multiple times or on unsupported platforms */
});

function Loading() {
  return <ActivityIndicator size="large" color="white" />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { success: migrationsSuccess, error: migrationError } = useMigrations(db, migrations);

  useEffect(() => {
    if (migrationsSuccess) {
      seedInitialAlarmsIfEmpty().catch((err: any) => {
        console.error('Failed to seed initial alarms:', err);
      });
    }
  }, [migrationsSuccess]);

  const [loaded, error] = useFonts({
    InstrumentSerif_400Regular_Italic,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    SpaceMono_400Regular,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  // Keep showing splash screen until fonts are ready
  if (!loaded && !error) {
    return null;
  }

  if (migrationError) { 
    SplashScreen.hideAsync();
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000', padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 18, marginBottom: 10 }}>
          Something went wrong
        </Text>
        <Text style={{ color: 'gray', textAlign: 'center' }}>
          {migrationError?.message}
        </Text>
      </View>
    );
  }

  return (
     <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<Loading />}>
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          options={{ enableChangeListener: true }}
          useSuspense
        >
          <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <AnimatedSplashOverlay />
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </ThemeProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}
