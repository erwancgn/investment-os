export type BrowserSyncRow = {
  source_key?: string;
  last_status?: string;
  last_started_at?: string | null;
  last_completed_at?: string | null;
};

export type BrowserSyncStatus = {
  configured?: boolean;
  metadataCacheFresh?: boolean;
  sources?: BrowserSyncRow[];
};

/** Browser access is read-only. Notion mutations are server-to-server only. */
export async function readBrowserNotionStatus(): Promise<BrowserSyncStatus> {
  const response = await fetch("/api/notion/status", { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as BrowserSyncStatus;
  if (!response.ok) throw new Error("Statut Notion indisponible");
  return payload;
}
