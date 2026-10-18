CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`due` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment` text NOT NULL,
	`user` text NOT NULL,
	`response` text NOT NULL,
	`submitted` text NOT NULL,
	`reviewed` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_assignment_submission` ON `submissions` (`assignment`,`user`);--> statement-breakpoint
ALTER TABLE `people` ADD `avatar` text DEFAULT '⚡' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `avatar_color` text DEFAULT 'lavender' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `bio` text DEFAULT '' NOT NULL;