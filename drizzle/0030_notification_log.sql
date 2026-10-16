CREATE TABLE `notification_log` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`path` text,
	`read_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_log_user_created_idx` ON `notification_log` (`user_id`,`created_at`);