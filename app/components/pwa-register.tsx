"use client";

import { useEffect, useRef, useState } from "react";

export function PwaRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const reloadTimer = useRef<number | undefined>(undefined);
  const accepted = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const installingListeners = new Map<ServiceWorker, () => void>();
    const updateTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => {});
    }, 15 * 60_000);

    const showIfWaiting = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    };

    const watchInstallingWorker = () => {
      const installing = registration?.installing;
      if (!installing || installingListeners.has(installing)) return;
      const listener = () => { if (installing.state === "installed") showIfWaiting(); };
      installingListeners.set(installing, listener);
      installing.addEventListener("statechange", listener);
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js");
        if (disposed) return;
        registrationRef.current = registration;
        registration.addEventListener("updatefound", watchInstallingWorker);
        watchInstallingWorker();
        await registration.update();
        showIfWaiting();
      } catch {
        // The dashboard remains fully usable if the browser blocks service workers.
      }
    };

    const onControllerChange = () => {
      if (!disposed && accepted.current) {
        window.clearTimeout(reloadTimer.current);
        window.location.reload();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch(() => {});
        showIfWaiting();
      }
    };

    const onPageShow = () => {
      void registration?.update().catch(() => {});
      showIfWaiting();
    };

    const onLoad = () => void register();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      disposed = true;
      window.clearTimeout(reloadTimer.current);
      window.clearInterval(updateTimer);
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      registration?.removeEventListener("updatefound", watchInstallingWorker);
      installingListeners.forEach((listener, worker) => worker.removeEventListener("statechange", listener));
      registrationRef.current = null;
    };
  }, []);

  const acceptUpdate = () => {
    accepted.current = true;
    const waiting = registrationRef.current?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    waiting.postMessage({ type: "SKIP_WAITING" });
    reloadTimer.current = window.setTimeout(() => window.location.reload(), 4000);
  };

  if (!updateAvailable) return null;
  return <aside className="pwa-update-banner" role="status" aria-live="polite">
    <div><strong>Nouvelle version disponible</strong><span>L’app peut être actualisée maintenant.</span></div>
    <div className="pwa-update-actions"><button onClick={acceptUpdate}>Mettre à jour</button><button className="pwa-update-later" onClick={() => setUpdateAvailable(false)}>Plus tard</button></div>
  </aside>;
}
