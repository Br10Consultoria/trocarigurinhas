-- Align legacy users table with the current Drizzle schema without dropping data.
ALTER TABLE `users` ADD COLUMN `userToken` varchar(64) NULL AFTER `whatsapp`;
UPDATE `users` SET `userToken` = CONCAT('legacy-', `id`) WHERE `userToken` IS NULL;
ALTER TABLE `users` MODIFY COLUMN `userToken` varchar(64) NOT NULL;
ALTER TABLE `users` ADD UNIQUE INDEX `users_user_token_unique` (`userToken`);
ALTER TABLE `users` ADD COLUMN `twoFactorEnabled` boolean NOT NULL DEFAULT false AFTER `role`;
ALTER TABLE `users` ADD COLUMN `twoFactorSecret` text NULL AFTER `twoFactorEnabled`;
