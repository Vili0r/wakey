import ActiveAlarmOverlay from '@/components/active-alarm-overlay';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { db } from '@/db/db';
import { alarms as alarmsTable } from '@/db/schema';
import type { ChallengeResult } from '@/types/challenge';
import { setActiveAlarm, useActiveAlarm, type ActiveAlarm } from '@/utils/active-alarm-store';
import {
  getPendingAlarm,
  NAG_ALARM_ID,
  safeAlarmKit,
  safeSnoozeActivity,
  uuidToDbId,
} from '@/utils/alarm-store';
import { getDefaultSoundId } from '@/utils/settings-store';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { eq } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { requireOptionalNativeModule } from 'expo';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, useColorScheme, View } from 'react-native';
import Purchases from 'react-native-purchases';
import { initExecutorch, models, useObjectDetection, usePoseEstimation, YOLO26N } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import migrations from '../../drizzle/migrations';

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

  // Configure RevenueCat
  useEffect(() => {
    Purchases.setDebugLogsEnabled(true);
    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'public_ios_key_here' });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'public_android_key_here' });
    }
  }, []);

  // ── Active alarm overlay state ───────────────────────────────────────
  // Read the shared store for our own logic (cold-launch dedupe, debug). The
  // overlay itself ALSO subscribes to the same store directly, so it no longer
  // depends on this component re-rendering it through props.
  const activeAlarm = useActiveAlarm();

  // ── Handle alarm trigger payloads (cold + warm launch) ───────────────
  // When an alarm fires, instead of navigating to /ringing we set overlay state.
  const handleAlarmPayload = useCallback(
    async (payload: { payload: string; alarmId?: string; fireDate?: string; title?: string }) => {
      if (!payload) return;

      // A dismiss from a native nag re-fire (alarm-nag.ts) only exists to pull
      // the app to the foreground. The real alarm's pending flag already keeps
      // the gate up with the correct challenge, so ignore it — otherwise we'd
      // overwrite the active alarm with the math fallback (NAG_ALARM_ID can't
      // be decoded to a real alarm row).
      if (payload.alarmId === NAG_ALARM_ID) {
        return;
      }

      // Snooze: this read is destructive (getLaunchPayload clears the payload),
      // so the root layout must own it for BOTH types — otherwise whichever
      // screen reads first consumes the payload and the other gets null. Start
      // the snooze countdown Live Activity here.
      if (payload.payload === 'snooze' && payload.fireDate) {
        try {
          safeSnoozeActivity.endAll();
          safeSnoozeActivity.start({
            fireDate: new Date(payload.fireDate).getTime(),
            title: payload.title || 'Alarm',
          });
        } catch (err) {
          console.error('Error starting snooze activity:', err);
        }
        return;
      }

      if (payload.payload === 'dismiss' && payload.alarmId) {
        try {
          // Look up the alarm to get challenge + difficulty
          const numericId = uuidToDbId(payload.alarmId);
          let challenge: string = 'math';
          let difficulty: ActiveAlarm['difficulty'] = 'standard';
          let soundId: string | null = null;
          let findItemIds: string[] | null = null;

          if (numericId === null) {
            // The dismiss payload's id isn't in our reversible scheme, so we
            // can't find the alarm and fall back to math. If this fires, the
            // scheduled id and the payload id have diverged.
            console.warn(
              '[handleAlarmPayload] Could not decode dbId from alarmId',
              payload.alarmId,
              '— falling back to math challenge.',
            );
          } else {
            const [dbAlarm] = await db
              .select()
              .from(alarmsTable)
              .where(eq(alarmsTable.id, numericId));
            if (dbAlarm) {
              challenge = dbAlarm.challenge;
              difficulty = dbAlarm.difficulty as ActiveAlarm['difficulty'];
              // Per-alarm sound is an override; when unset, fall back to the
              // user's default sound from Settings (not the registry default).
              soundId = dbAlarm.soundId ?? (await getDefaultSoundId());
              
              let parsedFindItemIds = dbAlarm.findItemIds;
              if (typeof parsedFindItemIds === 'string') {
                try {
                  parsedFindItemIds = JSON.parse(parsedFindItemIds);
                } catch {
                  parsedFindItemIds = null;
                }
              }
              findItemIds = Array.isArray(parsedFindItemIds) ? parsedFindItemIds : null;
            } else {
              console.warn(
                '[handleAlarmPayload] No alarm row for dbId',
                numericId,
                '(from',
                payload.alarmId,
                ') — falling back to math challenge.',
              );
            }
          }

          setActiveAlarm({
            alarmId: payload.alarmId,
            challenge,
            difficulty,
            soundId,
            findItemIds,
          });
        } catch (err) {
          console.error('Error handling alarm payload:', err);
          // Even on error, show the gate with math fallback
          setActiveAlarm({
            alarmId: payload.alarmId || 'unknown',
            challenge: 'math',
            difficulty: 'standard',
          });
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
            soundId: pending.soundId ?? null,
            findItemIds: pending.findItemIds ?? null,
          });
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
          // Check for native launch payload first (e.g., if woken up by the lock screen Dismiss action).
          // This read is destructive, so forward ANY payload type — handleAlarmPayload routes it.
          const coldPayload = safeAlarmKit.getLaunchPayload();
            if (coldPayload && coldPayload.payload) {
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
                soundId: pending.soundId ?? null,
                findItemIds: pending.findItemIds ?? null,
              });
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
          if (coldPayload && coldPayload.payload) {
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
      // Always clear the overlay. The overlay itself now handles the DB writing.
      setActiveAlarm(null);
    },
    [],
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
              } else if (alarm.challenge === 'find-item') {
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
            <View style={{ flex: 1 }}>
              <AnimatedSplashOverlay />
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <ModelWarmer pose={preloads.pose} object={preloads.object} />

              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="ringing" options={{ gestureEnabled: false, animation: 'fade' }} />
              </Stack>

              {/* The gate — a self-subscribing Modal (portal), so it floats
                  above the navigator and re-renders itself from the store. */}
              <ActiveAlarmOverlay
                onCompleted={handleAlarmCompleted}
                allowGiveUp={false}
              />
            </View>
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
