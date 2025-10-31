DROP INDEX `projectId_order_index`;--> statement-breakpoint
CREATE INDEX `fields_projectId_order_index` ON `fields` (`projectId`,`order`);--> statement-breakpoint
ALTER TABLE `cards` ADD `order` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `updatedAt` integer NOT NULL;--> statement-breakpoint
CREATE INDEX `cards_projectId_order_index` ON `cards` (`projectId`,`order`);