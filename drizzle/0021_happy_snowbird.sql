CREATE TABLE `ai_conversation` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`title` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_conversation_user_updated_idx` ON `ai_conversation` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_message` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`conversation_id` text(21) NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`plan_id` text(21),
	`error_code` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_message_conversation_created_idx` ON `ai_message` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_plan` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`conversation_id` text(21),
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`intent` text,
	`payload` text NOT NULL,
	`model_id` text,
	`applied_workout_ids` text,
	`applied_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_plan_user_created_idx` ON `ai_plan` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_plan_conversation_idx` ON `ai_plan` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `ai_profile` (
	`user_id` text(21) PRIMARY KEY NOT NULL,
	`goal` text,
	`activity_level` text,
	`sessions_per_week` integer,
	`session_minutes` integer,
	`dietary_pattern` text,
	`allergens` text,
	`conditions` text,
	`equipment` text,
	`daily_calorie_target` integer,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
