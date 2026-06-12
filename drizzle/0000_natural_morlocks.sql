CREATE TABLE `alarm_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alarm_id` integer,
	`challenge` text NOT NULL,
	`difficulty` text NOT NULL,
	`fired_at` integer NOT NULL,
	`resolved_at` integer,
	`outcome` text NOT NULL,
	`duration_ms` integer,
	`snooze_count` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`local_day` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`alarm_id`) REFERENCES `alarms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `alarm_events_fired_at_idx` ON `alarm_events` (`fired_at`);--> statement-breakpoint
CREATE INDEX `alarm_events_local_day_idx` ON `alarm_events` (`local_day`);--> statement-breakpoint
CREATE INDEX `alarm_events_alarm_idx` ON `alarm_events` (`alarm_id`);--> statement-breakpoint
CREATE TABLE `alarms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`label` text DEFAULT 'Alarm' NOT NULL,
	`days` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`challenge` text DEFAULT 'math' NOT NULL,
	`difficulty` text DEFAULT 'standard' NOT NULL,
	`sound_id` text,
	`vibrate` integer DEFAULT true NOT NULL,
	`next_trigger_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alarms_enabled_idx` ON `alarms` (`enabled`);--> statement-breakpoint
CREATE INDEX `alarms_next_trigger_idx` ON `alarms` (`next_trigger_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`name` text,
	`sound_enabled` integer DEFAULT true NOT NULL,
	`default_sound_id` text DEFAULT 'sunrise' NOT NULL,
	`haptics_enabled` integer DEFAULT true NOT NULL,
	`auto_silence_seconds` integer DEFAULT 0 NOT NULL,
	`default_challenge` text DEFAULT 'math' NOT NULL,
	`default_difficulty` text DEFAULT 'standard' NOT NULL,
	`volume` real DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `streak_days` (
	`day` text PRIMARY KEY NOT NULL,
	`beaten_count` integer DEFAULT 0 NOT NULL,
	`first_beaten_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streak_days_day_idx` ON `streak_days` (`day`);--> statement-breakpoint
CREATE TABLE `streak_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_beaten_day` text,
	`total_beaten` integer DEFAULT 0 NOT NULL,
	`freezes_remaining` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
