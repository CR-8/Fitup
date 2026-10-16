CREATE TABLE `water_log` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`date` text(10) NOT NULL,
	`amount_ml` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `water_log_user_date_idx` ON `water_log` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `user` ADD `water_target_ml` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `water_glass_ml` integer;