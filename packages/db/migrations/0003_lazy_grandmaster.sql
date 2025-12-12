PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` integer NOT NULL,
	`projectId` integer NOT NULL,
	`order` integer NOT NULL,
	`originalProjectId` integer,
	`originalCardId` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`projectId`, `id`),
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`originalProjectId`,`originalCardId`) REFERENCES `cards`(`projectId`,`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_cards`("id", "projectId", "order", "createdAt", "updatedAt") SELECT "id", "projectId", "order", "createdAt", "updatedAt" FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `cards_projectId_order_index` ON `cards` (`projectId`,`order`);