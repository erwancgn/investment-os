export type BrowserSyncRow = {
  source_key?: string;
  last_status?: string;
  last_started_at?: string | null;
  last_completed_at?: string | null;
  last_scanned_at?: string | null;
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

const refreshSourceKeys = ["companies","analyses","earnings","portfolio","watchlist","decisions","sources"] as const;

export async function waitForBrowserNotionRefresh(acceptedAt: string, timeoutMs = 60_000): Promise<BrowserSyncStatus> {
  const acceptedTime = Date.parse(acceptedAt);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await readBrowserNotionStatus();
    const states = new Map((status.sources ?? []).map(row => [row.source_key, row]));
    const allScanned = Number.isFinite(acceptedTime) && refreshSourceKeys.every(key => {
      const scannedAt = states.get(key)?.last_scanned_at;
      return scannedAt ? Date.parse(scannedAt) >= acceptedTime : false;
    });
    const failed = Number(status.queue?.failed ?? 0) > 0
      || Number(status.webhook?.failed ?? 0) > 0
      || (status.sources ?? []).some(row => row.last_status === "error");
    if (failed) throw new Error("La synchronisation documentaire a rencontré une erreur.");
    const idle = Number(status.queue?.remaining ?? 0) === 0
      && Number(status.webhook?.pending ?? 0) === 0
      && !(status.queue?.needsFinalize ?? false);
    if (allScanned && idle) return status;
    await new Promise(resolve => window.setTimeout(resolve, 750));
  }
  throw new Error("La synchronisation documentaire prend plus de temps que prévu.");
}
