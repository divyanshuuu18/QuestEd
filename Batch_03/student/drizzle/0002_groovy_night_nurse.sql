CREATE TABLE `api_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_limits_expiry` ON `api_limits` (`expires`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `questions_snapshot` text;--> statement-breakpoint
ALTER TABLE `attempts` ADD `rules_snapshot` text;--> statement-breakpoint
CREATE INDEX `attempts_submitted` ON `attempts` (`submitted`);--> statement-breakpoint
ALTER TABLE `auth_limits` ADD `expires` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `auth_limits_expiry` ON `auth_limits` (`expires`);--> statement-breakpoint
CREATE INDEX `events_user_day` ON `events` (`user`,`day`);--> statement-breakpoint
CREATE INDEX `events_day` ON `events` (`day`);--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `student_sessions` (`expires`);