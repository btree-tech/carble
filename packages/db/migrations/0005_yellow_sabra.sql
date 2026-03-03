ALTER TABLE `usersToProjects` ADD `role` text;--> statement-breakpoint
ALTER TABLE `usersToProjects` ADD `status` text;--> statement-breakpoint
ALTER TABLE `usersToProjects` ADD `createdAt` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `usersToProjects` ADD `updatedAt` integer NOT NULL;--> statement-breakpoint
CREATE INDEX `usersToProjects_role_index` ON `usersToProjects` (`role`);--> statement-breakpoint
CREATE INDEX `usersToProjects_status_index` ON `usersToProjects` (`status`);--> statement-breakpoint
CREATE INDEX `usersToProjects_createdAt_index` ON `usersToProjects` (`createdAt`);