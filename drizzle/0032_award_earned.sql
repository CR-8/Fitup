CREATE TABLE `award_earned` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`award_id` text NOT NULL,
	`period` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `award_earned_user_award_idx` ON `award_earned` (`user_id`,`award_id`);