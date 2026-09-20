CREATE TABLE `notion_documents` (
	`page_id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`title` text NOT NULL,
	`notion_url` text NOT NULL,
	`last_edited_time` text NOT NULL,
	`properties_json` text NOT NULL,
	`blocks_json` text NOT NULL,
	`plain_text` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notion_documents_source_idx` ON `notion_documents` (`source_key`);
--> statement-breakpoint
CREATE INDEX `notion_documents_edited_idx` ON `notion_documents` (`last_edited_time`);
--> statement-breakpoint
CREATE TABLE `notion_sync_state` (
	`source_key` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`last_status` text NOT NULL,
	`last_started_at` text,
	`last_completed_at` text,
	`last_error` text,
	`document_count` integer DEFAULT 0 NOT NULL
);
