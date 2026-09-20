"use client";

import { useEffect, useState } from "react";
import { readBrowserNotionStatus, type BrowserSyncStatus } from "../lib/notion-sync-client";

export function NotionBackgroundSync() {
  const [status, setStatus] = useState<BrowserSyncStatus | null>(null);

  useEffect(() => {
    let active = true;
    void readBrowserNotionStatus().then(next => { if (active) setStatus(next); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!status) return null;
  return <div className="notion-background-sync done" role="status"><span className="notion-background-sync-dot" /><span>Mises à jour Notion reçues par webhook signé</span></div>;
}
