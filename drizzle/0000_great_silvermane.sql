CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`description` text,
	`entityType` varchar(50),
	`entityId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `championships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`year` int,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `championships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `figurinhas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`championshipId` int NOT NULL,
	`cardNumber` varchar(48) NOT NULL,
	`playerName` varchar(180) NOT NULL,
	`type` enum('duplicate','needed') NOT NULL,
	`condition` enum('mint','good','fair','poor') NOT NULL DEFAULT 'good',
	`price` decimal(10,2),
	`notes` text,
	`status` enum('available','reserved','traded') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `figurinhas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`figurinhaId` int NOT NULL,
	`reservedByUserId` int NOT NULL,
	`ownerId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`status` enum('active','completed','expired','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `twoFactorBackupCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `twoFactorBackupCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(128) NOT NULL,
	`name` varchar(160),
	`email` varchar(320),
	`phone` varchar(24),
	`whatsapp` varchar(24),
	`userToken` varchar(64) NOT NULL DEFAULT 'pending',
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`twoFactorEnabled` boolean NOT NULL DEFAULT false,
	`twoFactorSecret` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_userToken_unique` UNIQUE(`userToken`)
);
--> statement-breakpoint
CREATE INDEX `activity_logs_user_idx` ON `activityLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `figurinhas_user_idx` ON `figurinhas` (`userId`);--> statement-breakpoint
CREATE INDEX `figurinhas_championship_idx` ON `figurinhas` (`championshipId`);--> statement-breakpoint
CREATE INDEX `figurinhas_status_idx` ON `figurinhas` (`status`);--> statement-breakpoint
CREATE INDEX `reservas_card_idx` ON `reservas` (`figurinhaId`);--> statement-breakpoint
CREATE INDEX `reservas_requester_idx` ON `reservas` (`reservedByUserId`);--> statement-breakpoint
CREATE INDEX `reservas_expiration_idx` ON `reservas` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `reservas_status_idx` ON `reservas` (`status`);--> statement-breakpoint
CREATE INDEX `two_factor_codes_user_idx` ON `twoFactorBackupCodes` (`userId`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);