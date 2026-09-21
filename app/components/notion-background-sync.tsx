"use client";

import { useEffect, useState } from "react";

const toastDurationMs = 4_000;

export function NotionBackgroundSync() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    const show = () => {
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), toastDurationMs);
    };

    window.addEventListener("notion-sync-complete", show);
    return () => {
      window.removeEventListener("notion-sync-complete", show);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="notion-background-sync" role="status" aria-live="polite" aria-atomic="true">
      <span className="notion-background-sync-dot" />
      <span>Mises à jour Notion reçues par webhook signé</span>
    </div>
  );
}
