CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`number` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contents` (
	`cardId` integer NOT NULL,
	`fieldId` integer NOT NULL,
	`body` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`cardId`, `fieldId`),
	FOREIGN KEY (`cardId`) REFERENCES `cards`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`fieldId`) REFERENCES `fields`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fields` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`name` text,
	`isVisible` integer DEFAULT true NOT NULL,
	`order` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`cardId` integer NOT NULL,
	`filename` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`cardId`) REFERENCES `cards`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_projectId_number_unique` ON `cards` (`projectId`,`number`);--> statement-breakpoint
CREATE INDEX `projectId_order_index` ON `fields` (`projectId`,`order`);--> statement-breakpoint
CREATE UNIQUE INDEX `images_projectId_cardId_filename_unique` ON `images` (`projectId`,`cardId`,`filename`);