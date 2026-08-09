ALTER TABLE `ai_profile` ADD `target_weight_kg` real;--> statement-breakpoint
ALTER TABLE `ai_profile` ADD `somatotype` text;--> statement-breakpoint
ALTER TABLE `ai_profile` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `display_name` text(80);--> statement-breakpoint
ALTER TABLE `user` ADD `account_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `account_email` text;--> statement-breakpoint
ALTER TABLE `user` ADD `account_provider` text;