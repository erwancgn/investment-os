"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createResourceCache, emptyResource, type ResourceSnapshot } from "./resource-cache";

const cache = createResourceCache();
export function preloadResource(url: string) { void cache.read(url); }
export async function readNotionStatus() {
  await cache.read("/api/notion/status");
  return cache.snapshot<{ configured?: boolean }>("/api/notion/status").data;
}
export function useResourceLifecycle() {
  useEffect(() => {
    let scheduled: number | undefined;
    const sync = () => {
      if (scheduled !== undefined) return;
      scheduled = window.setTimeout(() => {
        scheduled = undefined;
        cache.invalidate();
        cache.refreshActive();
      }, 250);
    };
    const resume = () => { if (document.visibilityState === "visible") cache.refreshActive(); };
    window.addEventListener("notion-sync-complete", sync);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("notion-sync-complete", sync);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      if (scheduled !== undefined) window.clearTimeout(scheduled);
    };
  }, []);
}
export function useClientResource<T>(url: string, refreshQuery = false, enabled = true) {
  const snapshot = useSyncExternalStore<ResourceSnapshot<T>>(
    useCallback(listener => cache.subscribe(url, listener), [url]),
    useCallback(() => cache.snapshot<T>(url), [url]),
    () => emptyResource,
  );
  useEffect(() => { if (enabled) void cache.read(url); }, [url, enabled]);
  useEffect(() => { if (!snapshot.loading) window.dispatchEvent(new Event("app-view-ready")); }, [snapshot.loading]);
  useEffect(() => {
    if (enabled && url === "/api/portfolio/live" && (snapshot.data as { refreshPending?: boolean } | undefined)?.refreshPending) void cache.read(url, true, true);
  }, [enabled, url, snapshot.data]);
  const refresh = useCallback(() => enabled ? cache.read(url, true, refreshQuery) : Promise.resolve(), [enabled, url, refreshQuery]);
  return { ...snapshot, refresh };
}
