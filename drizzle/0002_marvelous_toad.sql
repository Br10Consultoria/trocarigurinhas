CREATE TABLE `negotiations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservaId` int NOT NULL,
	`figurinhaId` int NOT NULL,
	`sellerId` int NOT NULL,
	`buyerId` int NOT NULL,
	`type` enum('trade','purchase') NOT NULL,
	`amount` decimal(10,2),
	`status` enum('completed') NOT NULL DEFAULT 'completed',
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `negotiations_id` PRIMARY KEY(`id`),
	CONSTRAINT `negotiations_reservaId_unique` UNIQUE(`reservaId`)
);
--> statement-breakpoint
CREATE INDEX `negotiations_buyer_idx` ON `negotiations` (`buyerId`);--> statement-breakpoint
CREATE INDEX `negotiations_seller_idx` ON `negotiations` (`sellerId`);--> statement-breakpoint
CREATE INDEX `negotiations_completed_at_idx` ON `negotiations` (`completedAt`);