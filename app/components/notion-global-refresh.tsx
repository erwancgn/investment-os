"use client";

import { useState } from "react";
import { ActionButton } from "./ui-primitives";

/**
 * App refresh is deliberately separate from Notion refresh: it only asks the
 * PWA for the latest published shell/features and never changes the Notion
 * snapshot. The Notion button lives in the source-document panel.
 */
export function NotionGlobalRefresh() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const refresh = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setProgress("Recherche de la dernière version…");
    try {
      const registration = "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
      if (registration) {
        await registration.update();
        if (registration.waiting) {
          setProgress("Chargement de la nouvelle version…");
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          // PwaRegister reloads on controllerchange. Keep this fallback for
          // browsers that do not dispatch it after a waiting worker accepts.
          window.setTimeout(() => window.location.reload(), 1200);
          return;
        }
      }
      setProgress("Version de l’app rechargée…");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Actualisation impossible");
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="header-refresh-control">
      <ActionButton compact onClick={refresh} disabled={running} title="Charger la dernière version de l’app" ariaLabel="Mettre à jour l’application">
        {running ? progress ?? "Mise à jour…" : "Maj app"}
      </ActionButton>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
