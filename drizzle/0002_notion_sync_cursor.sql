ALTER TABLE `notion_sync_state` ADD COLUMN `next_cursor` text;
--> statement-breakpoint
ALTER TABLE `notion_sync_state` ADD COLUMN `last_scanned_at` text;
