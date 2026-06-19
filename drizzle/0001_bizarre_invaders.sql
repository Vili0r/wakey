ALTER TABLE `settings` ADD `onboarding_complete` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `wake_hour` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `wake_minute` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `onboarding_answers` text;