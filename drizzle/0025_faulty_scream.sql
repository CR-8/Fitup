ALTER TABLE `exercise_set` ADD `paused_at` integer;--> statement-breakpoint
ALTER TABLE `exercise_set` ADD `paused_ms` integer DEFAULT 0 NOT NULL;