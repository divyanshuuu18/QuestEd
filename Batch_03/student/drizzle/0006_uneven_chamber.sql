CREATE TABLE `daily_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`day` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`questions` text NOT NULL,
	`faculty` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_challenge_subject_day` ON `daily_challenges` (`subject`,`day`);