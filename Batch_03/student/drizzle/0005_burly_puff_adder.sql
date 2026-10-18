DROP INDEX `quiz_once`;--> statement-breakpoint
ALTER TABLE `attempts` ADD `subject` text DEFAULT 'Mixed' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_once` ON `attempts` (`user`,`day`,`subject`);