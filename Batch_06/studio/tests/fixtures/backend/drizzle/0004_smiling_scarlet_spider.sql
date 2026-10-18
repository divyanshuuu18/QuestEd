CREATE TABLE `faculty_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`activated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `faculty_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`faculty` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `faculty_sessions_expiry` ON `faculty_sessions` (`expires`);