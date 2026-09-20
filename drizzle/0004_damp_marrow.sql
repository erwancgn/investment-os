CREATE TABLE `notion_webhook_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`verification_token` text NOT NULL,
	`configured_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notion_webhook_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`event_timestamp` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`lease_owner` text,
	`lease_until` text,
	`last_error` text,
	`received_at` text NOT NULL,
	`processed_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notion_webhook_events_status_idx` ON `notion_webhook_events` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notion_webhook_events_entity_idx` ON `notion_webhook_events` (`entity_id`,`event_timestamp`);