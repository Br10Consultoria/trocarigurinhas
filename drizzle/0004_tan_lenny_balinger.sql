ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('trade_accepted','trade_completed','system_notice') NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `category` enum('trade','purchase','system') DEFAULT 'system' NOT NULL;--> statement-breakpoint
CREATE INDEX `notifications_category_idx` ON `notifications` (`userId`,`category`);