CREATE TABLE `meal` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`date` text(10) NOT NULL,
	`slot` text NOT NULL,
	`plan_id` text(21),
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_user_date_idx` ON `meal` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `meal_plan_idx` ON `meal` (`plan_id`);--> statement-breakpoint
CREATE TABLE `meal_item` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`meal_id` text(21) NOT NULL,
	`name` text NOT NULL,
	`quantity` text,
	`calories` real,
	`protein_g` real,
	`carbs_g` real,
	`fat_g` real,
	`consumed_at` integer,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_item_meal_order_idx` ON `meal_item` (`meal_id`,`order`);--> statement-breakpoint
ALTER TABLE `ai_profile` ADD `daily_protein_target_g` integer;--> statement-breakpoint
ALTER TABLE `ai_profile` ADD `daily_carbs_target_g` integer;--> statement-breakpoint
ALTER TABLE `ai_profile` ADD `daily_fat_target_g` integer;