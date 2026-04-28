PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_usersToProjects` (
	`userId` text NOT NULL,
	`projectId` integer NOT NULL,
	`role` text,
	`status` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `projectId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_usersToProjects`("userId", "projectId", "role", "status", "createdAt", "updatedAt") SELECT "userId", "projectId", 'owner', NULL, cast(unixepoch('subsecond') as integer), cast(unixepoch('subsecond') as integer) FROM `usersToProjects`;--> statement-breakpoint
DROP TABLE `usersToProjects`;--> statement-breakpoint
ALTER TABLE `__new_usersToProjects` RENAME TO `usersToProjects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `usersToProjects_role_index` ON `usersToProjects` (`role`);--> statement-breakpoint
CREATE INDEX `usersToProjects_status_index` ON `usersToProjects` (`status`);--> statement-breakpoint
CREATE INDEX `usersToProjects_createdAt_index` ON `usersToProjects` (`createdAt`);
