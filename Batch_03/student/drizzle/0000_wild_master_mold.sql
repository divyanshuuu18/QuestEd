CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`day` text NOT NULL,
	`question_ids` text NOT NULL,
	`answers` text,
	`correct` integer,
	`submitted` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_once` ON `attempts` (`user`,`day`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`xp` integer NOT NULL,
	`day` text NOT NULL,
	`detail` text NOT NULL,
	`void_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_once` ON `events` (`user`,`kind`,`source`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`campus` text DEFAULT 'Jaipur' NOT NULL,
	`anonymous` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`joined` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`topic` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`answer` integer NOT NULL,
	`explanation` text NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL
);
