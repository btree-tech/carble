CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`filename` text NOT NULL,
	`originalFilename` text NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`notifiedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `status_index` ON `imports` (`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cards` (
	`id` integer NOT NULL,
	`projectId` integer NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`projectId`, `id`),
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cards`("id", "projectId", "createdAt") SELECT "id", "projectId", "createdAt" FROM `cards`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
ALTER TABLE `__new_cards` RENAME TO `cards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_contents` (
	`projectId` integer NOT NULL,
	`cardId` integer NOT NULL,
	`fieldId` integer NOT NULL,
	`body` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`projectId`, `cardId`, `fieldId`),
	FOREIGN KEY (`fieldId`) REFERENCES `fields`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`,`cardId`) REFERENCES `cards`(`projectId`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contents`("projectId", "cardId", "fieldId", "body", "createdAt", "updatedAt") SELECT "projectId", "cardId", "fieldId", "body", "createdAt", "updatedAt" FROM `contents`;--> statement-breakpoint
DROP TABLE `contents`;--> statement-breakpoint
ALTER TABLE `__new_contents` RENAME TO `contents`;