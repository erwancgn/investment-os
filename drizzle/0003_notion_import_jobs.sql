CREATE TABLE `notion_import_jobs` (
	`page_id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`last_edited_time` text NOT NULL,
	`page_json` text NOT NULL,
	`blocks_json` text DEFAULT '[]' NOT NULL,
	`work_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`lease_owner` text,
	`lease_until` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notion_import_jobs_status_idx` ON `notion_import_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notion_import_jobs_source_idx` ON `notion_import_jobs` (`source_key`);
