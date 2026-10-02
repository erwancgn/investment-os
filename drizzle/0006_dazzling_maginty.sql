CREATE TABLE `notion_analysis_writes` (
	`run_id` text PRIMARY KEY NOT NULL,
	`digest` text NOT NULL,
	`page_id` text,
	`phase` text NOT NULL,
	`owner` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`previous_current` text
);
