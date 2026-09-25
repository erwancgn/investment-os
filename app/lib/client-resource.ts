"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createResourceCache, emptyResource, type ResourceSnapshot } from "./resource-cache";
import { readBrowserNotionStatus } from "./notion-sync-client";

const cache = createResourceCache();
export function preloadResource(url: string) { void cache.read(url); }
export async function refreshResource(url: string) {
  await cache.read(url, true);
  const error = cache.snapshot(url).error;
  if (error) throw new Error(error);
}
export function resourceSnapshot<T>(url: string) { return cache.snapshot<T>(url); }
export async function readNotionStatus() {
  await cache.read("/api/notion/status");
  return cache.snapshot<{ configured?: boolean }>("/api/notion/status").data;
}
export function useResourceLifecycle() {
  useEffect(() => {
    let scheduled: number | undefined;
    let latestNotionSync: string | null | undefined;

    const checkNotionSync = async () => {
      try {
        const status = await readBrowserNotionStatus();
        const latest = (status.sources ?? [])
          .map(source => source.last_completed_at)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null;
        if (latestNotionSync !== undefined && latest && (!latestNotionSync || latest > latestNotionSync)) {
          window.dispatchEvent(new Event("notion-sync-complete"));
        }
        latestNotionSync = latest;
      } catch {
        // Sync status is informational and must never block resource refreshes.
      }
    };

    const sync = () => {
      if (scheduled !== undefined) return;
      scheduled = window.setTimeout(() => {
        scheduled = undefined;
        cache.invalidate();
        cache.refreshActive();
      }, 250);
    };
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      cache.refreshActive();
      void checkNotionSync();
    };
    window.addEventListener("notion-sync-complete", sync);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    void checkNotionSync();
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
  const refresh = useCallback((forceProvider = false) => enabled ? cache.read(url, true, refreshQuery && forceProvider ? "force" : refreshQuery) : Promise.resolve(), [enabled, url, refreshQuery]);
  return { ...snapshot, refresh };
}
