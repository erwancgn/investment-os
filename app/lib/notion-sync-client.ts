export type BrowserSyncRow = {
  source_key?: string;
  last_status?: string;
  last_started_at?: string | null;
  last_completed_at?: string | null;
};

export type BrowserSyncStatus = {
  configured?: boolean;
  metadataCacheFresh?: boolean;
  queue?: { remaining?: number; failed?: number; needsFinalize?: boolean };
  webhook?: { pending?: number; failed?: number };
  sources?: BrowserSyncRow[];
};

export type BrowserRefreshLaunch = {
  accepted?: boolean;
  running?: boolean;
  skipped?: boolean;
  reason?: string;
  acceptedAt?: string;
};

export async function readBrowserNotionStatus(): Promise<BrowserSyncStatus> {
  const response = await fetch("/api/notion/status", { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as BrowserSyncStatus;
  if (!response.ok) throw new Error("Statut Notion indisponible");
  return payload;
}

/** Owner-private manual reconciliation. No Notion/server secret is sent to the browser. */
export async function requestBrowserNotionRefresh(): Promise<BrowserRefreshLaunch> {
  const response = await fetch("/api/notion/refresh", {
    method: "POST",
    cache: "no-store",
    headers: { "x-investment-os-action": "notion-refresh" },
  });
  const payload = await response.json().catch(() => ({})) as BrowserRefreshLaunch & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Mise à jour documentaire indisponible");
  return payload;
}
