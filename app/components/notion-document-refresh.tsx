"use client";

import { useState } from "react";
import { requestBrowserNotionRefresh, waitForBrowserNotionRefresh } from "../lib/notion-sync-client";
import { ActionButton } from "./ui-primitives";

export function NotionDocumentRefresh() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const launch = await requestBrowserNotionRefresh();
      if (launch.accepted && launch.acceptedAt) {
        await waitForBrowserNotionRefresh(launch.acceptedAt);
      } else if (launch.running) {
        await waitForBrowserNotionRefresh();
      }
      window.dispatchEvent(new Event("notion-sync-complete"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mise à jour documentaire impossible");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="header-refresh-control">
      <ActionButton
        compact
        onClick={refresh}
        disabled={running}
        title="Synchroniser les données Notion"
        ariaLabel="Mettre à jour les données Notion"
      >
        {running ? "Synchro…" : "Maj data"}
      </ActionButton>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
