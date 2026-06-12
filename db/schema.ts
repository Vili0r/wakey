import { relations, sql } from 'drizzle-orm';
import {
    index,
    integer,
    real,
    sqliteTable,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/* ------------------------------------------------------------------ */
/* Shared column helpers                                               */
/* ------------------------------------------------------------------ */

/** Unix-ms timestamp stored as integer, surfaced as a JS Date. */
const createdAt = integer('created_at', { mode: 'timestamp_ms' })
  .notNull()
  .default(sql`(unixepoch() * 1000)`);

const updatedAt = integer('updated_at', { mode: 'timestamp_ms' })
  .notNull()
  .default(sql`(unixepoch() * 1000)`);

/* Enumerated value sets — kept here so the UI can import them too. */
export const CHALLENGE_TYPES = ['math', 'shake', 'pattern', 'steps'] as const;
export const DIFFICULTIES = ['gentle', 'standard', 'brutal'] as const;
export const EVENT_OUTCOMES = [
  'dismissed', //  challenge beaten → counts toward streak
  'snoozed', //    bought more time
  'auto_silenced', // gave up after the timeout window
  'missed', //     never acknowledged
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type EventOutcome = (typeof EVENT_OUTCOMES)[number];

/* ------------------------------------------------------------------ */
/* alarms — the user's configured alarms                               */
/* ------------------------------------------------------------------ */

export const alarms = sqliteTable(
  'alarms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Wall-clock time, 24h. Minute 0–59.
    hour: integer('hour').notNull(),
    minute: integer('minute').notNull(),

    label: text('label').notNull().default('Alarm'),

    // Repeat days as JSON array of weekday indices (0 = Sun … 6 = Sat).
    // Empty array = fires once, then disables itself.
    days: text('days', { mode: 'json' })
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'`),

    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

    // What it costs to silence this one.
    challenge: text('challenge', { enum: CHALLENGE_TYPES })
      .notNull()
      .default('math'),
    difficulty: text('difficulty', { enum: DIFFICULTIES })
      .notNull()
      .default('standard'),

    // Per-alarm overrides (fall back to settings when null).
    soundId: text('sound_id'),
    vibrate: integer('vibrate', { mode: 'boolean' }).notNull().default(true),

    // Cache of the next fire time (unix-ms) so the home list can sort
    // without recomputing. Recompute on save / after each firing.
    nextTriggerAt: integer('next_trigger_at', { mode: 'timestamp_ms' }),

    createdAt,
    updatedAt,
  },
  (t) => [
    index('alarms_enabled_idx').on(t.enabled),
    index('alarms_next_trigger_idx').on(t.nextTriggerAt),
  ],
);

/* ------------------------------------------------------------------ */
/* alarm_events — one row per firing; the source of truth for streaks  */
/* ------------------------------------------------------------------ */

export const alarmEvents = sqliteTable(
  'alarm_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Null after its alarm is deleted — history survives the alarm.
    alarmId: integer('alarm_id').references(() => alarms.id, {
      onDelete: 'set null',
    }),

    // Snapshot so stats stay meaningful even if the alarm is gone.
    challenge: text('challenge', { enum: CHALLENGE_TYPES }).notNull(),
    difficulty: text('difficulty', { enum: DIFFICULTIES }).notNull(),

    firedAt: integer('fired_at', { mode: 'timestamp_ms' }).notNull(),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),

    outcome: text('outcome', { enum: EVENT_OUTCOMES }).notNull(),

    // How hard you fought: time to silence, snoozes used, attempts taken.
    durationMs: integer('duration_ms'),
    snoozeCount: integer('snooze_count').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),

    // Local calendar day key 'YYYY-MM-DD' — lets us group by day without
    // timezone math in queries, and links cleanly to streak_days.
    localDay: text('local_day').notNull(),

    createdAt,
  },
  (t) => [
    index('alarm_events_fired_at_idx').on(t.firedAt),
    index('alarm_events_local_day_idx').on(t.localDay),
    index('alarm_events_alarm_idx').on(t.alarmId),
  ],
);

/* ------------------------------------------------------------------ */
/* streak_days — the ledger: one row per calendar day with a win        */
/* ------------------------------------------------------------------ */

export const streakDays = sqliteTable(
  'streak_days',
  {
    // 'YYYY-MM-DD' in the device's local timezone. One row per day.
    day: text('day').primaryKey(),

    // How many alarms were beaten that day (≥ 1 keeps the streak alive).
    beatenCount: integer('beaten_count').notNull().default(0),

    // First successful dismissal of the day — your "wake time".
    firstBeatenAt: integer('first_beaten_at', { mode: 'timestamp_ms' }),

    createdAt,
  },
  (t) => [uniqueIndex('streak_days_day_idx').on(t.day)],
);

/* ------------------------------------------------------------------ */
/* streak_state — singleton cache of the current/longest streak         */
/* (id is always 1; read it directly instead of scanning streak_days)   */
/* ------------------------------------------------------------------ */

export const streakState = sqliteTable('streak_state', {
  id: integer('id').primaryKey().default(1),

  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),

  // 'YYYY-MM-DD' of the last day the streak advanced. Compare against
  // today (and yesterday) to decide: continue, hold, or reset to 0.
  lastBeatenDay: text('last_beaten_day'),

  // Lifetime counter — powers "47 alarms beaten" on the settings card.
  totalBeaten: integer('total_beaten').notNull().default(0),

  // Optional grace: number of missed days the streak can absorb.
  freezesRemaining: integer('freezes_remaining').notNull().default(0),

  updatedAt,
});

/* ------------------------------------------------------------------ */
/* settings — singleton app preferences (id is always 1)                */
/* ------------------------------------------------------------------ */

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),

  name: text('name'),

  soundEnabled: integer('sound_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  defaultSoundId: text('default_sound_id').notNull().default('sunrise'),
  hapticsEnabled: integer('haptics_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),

  // Give-up window in seconds; 0 = never auto-silence.
  autoSilenceSeconds: integer('auto_silence_seconds').notNull().default(0),

  // Defaults pre-filled on the Create screen.
  defaultChallenge: text('default_challenge', { enum: CHALLENGE_TYPES })
    .notNull()
    .default('math'),
  defaultDifficulty: text('default_difficulty', { enum: DIFFICULTIES })
    .notNull()
    .default('standard'),

  // Volume 0–1 for the alarm tone.
  volume: real('volume').notNull().default(1),

  updatedAt,
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const alarmsRelations = relations(alarms, ({ many }) => ({
  events: many(alarmEvents),
}));

export const alarmEventsRelations = relations(alarmEvents, ({ one }) => ({
  alarm: one(alarms, {
    fields: [alarmEvents.alarmId],
    references: [alarms.id],
  }),
  streakDay: one(streakDays, {
    fields: [alarmEvents.localDay],
    references: [streakDays.day],
  }),
}));

/* ------------------------------------------------------------------ */
/* Inferred types — import these in the app instead of redefining       */
/* ------------------------------------------------------------------ */

export type Alarm = typeof alarms.$inferSelect;
export type NewAlarm = typeof alarms.$inferInsert;

export type AlarmEvent = typeof alarmEvents.$inferSelect;
export type NewAlarmEvent = typeof alarmEvents.$inferInsert;

export type StreakDay = typeof streakDays.$inferSelect;
export type NewStreakDay = typeof streakDays.$inferInsert;

export type StreakState = typeof streakState.$inferSelect;
export type Settings = typeof settings.$inferSelect;