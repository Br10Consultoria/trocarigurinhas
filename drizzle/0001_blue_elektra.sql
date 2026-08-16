CREATE TABLE `adminTwoFactorSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminTwoFactorSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `adminTwoFactorSessions_sessionHash_unique` UNIQUE(`sessionHash`)
);
--> statement-breakpoint
CREATE INDEX `admin_2fa_sessions_user_idx` ON `adminTwoFactorSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `admin_2fa_sessions_expires_idx` ON `adminTwoFactorSessions` (`expiresAt`);