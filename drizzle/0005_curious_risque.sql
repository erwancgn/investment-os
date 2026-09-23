CREATE TABLE `quote_history_cache` (
	`provider_symbol` text PRIMARY KEY NOT NULL,
	`currency` text NOT NULL,
	`history_json` text NOT NULL,
	`fetched_at` text NOT NULL
);
