import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const quoteCache = sqliteTable("quote_cache", {
  assetId: text("asset_id").primaryKey(),
  provider: text("provider").notNull(),
  providerSymbol: text("provider_symbol").notNull(),
  nativePrice: real("native_price").notNull(),
  nativeCurrency: text("native_currency").notNull(),
  previousClose: real("previous_close"),
  marketTime: text("market_time").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  validationFlags: text("validation_flags").notNull().default("[]"),
});

export const quoteHistoryCache = sqliteTable("quote_history_cache", {
  providerSymbol: text("provider_symbol").primaryKey(),
  currency: text("currency").notNull(),
  historyJson: text("history_json").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const notionDocuments = sqliteTable("notion_documents", {
  pageId: text("page_id").primaryKey(),
  sourceKey: text("source_key").notNull(),
  title: text("title").notNull(),
  notionUrl: text("notion_url").notNull(),
  lastEditedTime: text("last_edited_time").notNull(),
  propertiesJson: text("properties_json").notNull(),
  blocksJson: text("blocks_json").notNull(),
  plainText: text("plain_text").notNull(),
  syncedAt: text("synced_at").notNull(),
}, table => [
  index("notion_documents_source_idx").on(table.sourceKey),
  index("notion_documents_edited_idx").on(table.lastEditedTime),
]);

export const notionSyncState = sqliteTable("notion_sync_state", {
  sourceKey: text("source_key").primaryKey(),
  dataSourceId: text("data_source_id").notNull(),
  lastStatus: text("last_status").notNull(),
  lastStartedAt: text("last_started_at"),
  lastCompletedAt: text("last_completed_at"),
  lastError: text("last_error"),
  documentCount: integer("document_count").notNull().default(0),
  nextCursor: text("next_cursor"),
  lastScannedAt: text("last_scanned_at"),
});

export const notionImportJobs = sqliteTable("notion_import_jobs", {
  pageId: text("page_id").primaryKey(),
  sourceKey: text("source_key").notNull(),
  lastEditedTime: text("last_edited_time").notNull(),
  pageJson: text("page_json").notNull(),
  blocksJson: text("blocks_json").notNull().default("[]"),
  workJson: text("work_json").notNull().default("[]"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  leaseOwner: text("lease_owner"),
  leaseUntil: text("lease_until"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [
  index("notion_import_jobs_status_idx").on(table.status, table.nextAttemptAt),
  index("notion_import_jobs_source_idx").on(table.sourceKey),
]);

export const notionWebhookConfig = sqliteTable("notion_webhook_config", {
  id: integer("id").primaryKey(),
  verificationToken: text("verification_token").notNull(),
  configuredAt: text("configured_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const notionWebhookEvents = sqliteTable("notion_webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  leaseOwner: text("lease_owner"),
  leaseUntil: text("lease_until"),
  lastError: text("last_error"),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
  updatedAt: text("updated_at").notNull(),
}, table => [
  index("notion_webhook_events_status_idx").on(table.status, table.nextAttemptAt),
  index("notion_webhook_events_entity_idx").on(table.entityId, table.eventTimestamp),
]);

/** Durable mutation reconciliation; run_id is the internal [Run ID, module] key, with no body or credential. */
export const notionAnalysisWrites = sqliteTable("notion_analysis_writes", {
  runId: text("run_id").primaryKey(),
  digest: text("digest").notNull(),
  pageId: text("page_id"),
  phase: text("phase").notNull(),
  owner: text("owner"),
  leaseUntil: integer("lease_until").notNull().default(0),
  previousCurrent: text("previous_current"),
});
