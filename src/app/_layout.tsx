import { AnimatedSplashOverlay } from '@/components/animated-icon';
import ActiveAlarmOverlay, { type ActiveAlarm } from '@/components/active-alarm-overlay';
import { db } from '@/db/db';
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
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, useColorScheme, View, AppState } from 'react-native';
import { initExecutorch, models, usePoseEstimation, useObjectDetection, YOLO26N } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import migrations from '../../drizzle/migrations';
import { alarms as alarmsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  safeAlarmKit,
  uuidToDbId,
  resolveAlarmAndRecord,
  getPendingAlarm,
} from '@/utils/alarm-store';
import type { ChallengeResult } from '@/types/challenge';
import type { ChallengeType, Difficulty } from '@/db/schema';

// Initialize ExecuTorch once at the app entry point
try {
  initExecutorch({ resourceFetcher: ExpoResourceFetcher });
} catch (e) {
  console.warn('ExecuTorch failed to initialize at entry point:', e);
}

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

  // ── Active alarm overlay state ───────────────────────────────────────
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const firedAtRef = useState(() => new Date())[0]; // stable ref for firedAt
  const [firedAt, setFiredAt] = useState<Date>(new Date());

  // ── Handle alarm trigger payloads (cold + warm launch) ───────────────
  // When an alarm fires, instead of navigating to /ringing we set overlay state.
  const handleAlarmPayload = useCallback(
    async (payload: { payload: string; alarmId?: string; fireDate?: string; title?: string }) => {
      if (!payload) return;

      if (payload.payload === 'dismiss' && payload.alarmId) {
        try {
          // Look up the alarm to get challenge + difficulty
          const numericId = uuidToDbId(payload.alarmId);
          let challenge: string = 'math';
          let difficulty: ActiveAlarm['difficulty'] = 'standard';

          if (numericId !== null) {
            const [dbAlarm] = await db
              .select()
              .from(alarmsTable)
              .where(eq(alarmsTable.id, numericId));
            if (dbAlarm) {
              challenge = dbAlarm.challenge;
              difficulty = dbAlarm.difficulty as ActiveAlarm['difficulty'];
            }
          }

          setActiveAlarm({
            alarmId: payload.alarmId,
            challenge,
            difficulty,
          });
          setFiredAt(new Date());
        } catch (err) {
          console.error('Error handling alarm payload:', err);
          // Even on error, show the gate with math fallback
          setActiveAlarm({
            alarmId: payload.alarmId || 'unknown',
            challenge: 'math',
            difficulty: 'standard',
          });
          setFiredAt(new Date());
        }
      }
      // Snooze payloads are handled by the home screen (Live Activity)
    },
    [],
  );

  // ── Re-arm on cold launch: check for a pending alarm ─────────────────
  useEffect(() => {
    if (!loaded || error || !migrationsSuccess) return;
    let cancelled = false;

    (async () => {
      try {
        const pending = await getPendingAlarm();
        if (pending && !cancelled) {
          setActiveAlarm({
            alarmId: pending.alarmId,
            challenge: pending.challenge,
            difficulty: pending.difficulty as ActiveAlarm['difficulty'],
          });
          setFiredAt(new Date());
        }
      } catch (err) {
        console.error('Error checking pending alarm on launch:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, error, migrationsSuccess]);

  // ── Foreground re-assertion: if the app comes to foreground with a
  //    pending alarm, make sure the overlay is still showing ─────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        try {
          // Check for native launch payload first (e.g., if woken up by the lock screen Dismiss action)
          const coldPayload = safeAlarmKit.getLaunchPayload();
          if (coldPayload && coldPayload.payload === 'dismiss' && coldPayload.alarmId) {
            handleAlarmPayload(coldPayload);
            return;
          }
        } catch (err) {
          console.error('Error checking native launch payload on resume:', err);
        }

        if (!activeAlarm) {
          try {
            const pending = await getPendingAlarm();
            if (pending) {
              setActiveAlarm({
                alarmId: pending.alarmId,
                challenge: pending.challenge,
                difficulty: pending.difficulty as ActiveAlarm['difficulty'],
              });
              setFiredAt(new Date());
            }
          } catch {}
        }
      }
    });
    return () => sub.remove();
  }, [activeAlarm, handleAlarmPayload]);

  // Cold launch payload routing
  useEffect(() => {
    if (loaded && !error && migrationsSuccess) {
      const timer = setTimeout(() => {
        try {
          const coldPayload = safeAlarmKit.getLaunchPayload();
          if (coldPayload && coldPayload.payload === 'dismiss' && coldPayload.alarmId) {
            handleAlarmPayload(coldPayload);
          }
        } catch (err) {
          console.error('Error handling cold launch payload:', err);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loaded, error, migrationsSuccess, handleAlarmPayload]);

  // Warm launch payload listener
  useEffect(() => {
    if (!migrationsSuccess) return;
    const subscription = safeAlarmKit.addLaunchPayloadListener((payload: any) => {
      if (payload?.payload === 'dismiss' && payload.alarmId) {
        handleAlarmPayload(payload);
      }
    });
    return () => subscription.remove();
  }, [migrationsSuccess, handleAlarmPayload]);

  // ── Challenge completed handler ──────────────────────────────────────
  const handleAlarmCompleted = useCallback(
    async (alarm: ActiveAlarm, result: ChallengeResult) => {
      try {
        await resolveAlarmAndRecord({
          alarmId: alarm.alarmId,
          challenge: alarm.challenge as ChallengeType,
          difficulty: alarm.difficulty as Difficulty,
          firedAt,
          outcome: 'dismissed',
          attempts: result.attempts,
          snoozeCount: 0,
        });
      } catch (err) {
        console.error('Error recording alarm event:', err);
      }
      // Always clear the overlay regardless of logging success
      setActiveAlarm(null);
    },
    [firedAt],
  );

  const [preloads, setPreloads] = useState({ pose: false, object: false });

  // 1. Model preloading logic based on scheduled alarms
  useEffect(() => {
    if (!migrationsSuccess) return;

    const checkPreload = async () => {
      try {
        const enabledAlarms = await db
          .select()
          .from(alarmsTable)
          .where(eq(alarmsTable.enabled, true));

        const now = Date.now();
        const fifteenMins = 15 * 60 * 1000;

        let needsPose = false;
        let needsObject = false;

        for (const alarm of enabledAlarms) {
          if (alarm.nextTriggerAt) {
            const diff = alarm.nextTriggerAt.getTime() - now;
            if (diff > 0 && diff <= fifteenMins) {
              if (alarm.challenge === 'squats' || alarm.challenge === 'pushups') {
                needsPose = true;
              } else if (alarm.challenge === 'scan' || alarm.challenge === 'find-item') {
                needsObject = true;
              }
            }
          }
        }

        setPreloads({ pose: needsPose, object: needsObject });
      } catch (err) {
        console.error('Error checking model preloads:', err);
      }
    };

    checkPreload();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkPreload();
      }
    });

    const interval = setInterval(checkPreload, 60_000);

    return () => {
      appStateSub.remove();
      clearInterval(interval);
    };
  }, [migrationsSuccess]);

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
            <ModelWarmer pose={preloads.pose} object={preloads.object} />

            {/* The gate — rendered ABOVE the navigator, driven by state. */}
            <ActiveAlarmOverlay
              alarm={activeAlarm}
              onCompleted={handleAlarmCompleted}
              allowGiveUp={false}
            />

            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="ringing" options={{ gestureEnabled: false, animation: 'fade' }} />
            </Stack>
          </ThemeProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}

// ------------------------------------------------------------------
// Background Model Warmer Components
// ------------------------------------------------------------------

function PosePreloader() {
  usePoseEstimation({ model: models.pose_estimation.yolo26n() });
  return null;
}

function ObjectPreloader() {
  useObjectDetection({ model: YOLO26N });
  return null;
}

function ModelWarmer({ pose, object }: { pose: boolean; object: boolean }) {
  return (
    <>
      {pose && <PosePreloader />}
      {object && <ObjectPreloader />}
    </>
  );
}
