CREATE TABLE `quote_cache` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_symbol` text NOT NULL,
	`native_price` real NOT NULL,
	`native_currency` text NOT NULL,
	`previous_close` real,
	`market_time` text NOT NULL,
	`fetched_at` text NOT NULL,
	`validation_flags` text DEFAULT '[]' NOT NULL
);
