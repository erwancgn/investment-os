export type ResourceSnapshot<T> = { data?: T; loading: boolean; error: string; updatedAt: number };
export const emptyResource = { loading: true, error: "", updatedAt: 0 };
type Entry = { revision: number; snapshot: ResourceSnapshot<unknown>; listeners: Set<() => void>; promise?: Promise<void>; controller?: AbortController; dirty?: boolean; refreshQuery?: boolean | "force" };

// Session memory only: private API responses never enter persistent browser storage.
export function createResourceCache(fetcher: typeof fetch = fetch) {
  const entries = new Map<string, Entry>();
  let epoch = 0;
  const notify = (entry: Entry) => entry.listeners.forEach(listener => listener());
  function entryFor(url: string) {
    let entry = entries.get(url);
    if (!entry) {
      for (const [key, candidate] of entries) {
        if (entries.size < 32) break;
        if (!candidate.listeners.size && !candidate.promise) entries.delete(key);
      }
      entry = { revision: 0, snapshot: emptyResource, listeners: new Set() };
      entries.set(url, entry);
    }
    return entry;
  }
  function clear(error = "") {
    epoch++;
    entries.forEach(entry => {
      entry.controller?.abort();
      entry.promise = undefined;
      entry.dirty = false;
      entry.snapshot = error ? { ...emptyResource, loading: false, error } : emptyResource;
      notify(entry);
    });
  }
  function read(url: string, force = false, refreshQuery: boolean | "force" = false): Promise<void> {
    const entry = entryFor(url);
    if (entry.promise) {
      if (refreshQuery && (!entry.refreshQuery || refreshQuery === "force" && entry.refreshQuery !== "force")) entry.dirty = true;
      entry.refreshQuery = refreshQuery === "force" ? "force" : entry.refreshQuery || refreshQuery;
      return entry.promise;
    }
    if (!force && Date.now() - entry.snapshot.updatedAt < 60_000) return Promise.resolve();
    const requestEpoch = epoch;
    const requestRevision = ++entry.revision;
    const isCurrent = () => requestEpoch === epoch && requestRevision === entry.revision;
    entry.dirty = false;
    entry.refreshQuery = refreshQuery;
    const controller = new AbortController();
    entry.controller = controller;
    entry.snapshot = { ...entry.snapshot, loading: true, error: "" };
    notify(entry);
    entry.promise = Promise.resolve().then(async () => {
      try {
        const response = await fetcher(url + (refreshQuery ? `${url.includes("?") ? "&" : "?"}refresh=1${refreshQuery === "force" ? "&force=1" : ""}` : ""), { cache: "no-store", signal: controller.signal });
        if (!isCurrent()) return;
        if (response.status === 401 || response.status === 403) {
          clear("Session expirée. Reconnecte-toi pour actualiser les données.");
          return;
        }
        if (!response.ok) throw new Error("Actualisation indisponible. Réessaie dans un instant.");
        const data = await response.json();
        if (isCurrent() && !entry.dirty) entry.snapshot = { data, loading: false, error: "", updatedAt: Date.now() };
      } catch (reason) {
        if (isCurrent()) entry.snapshot = { ...entry.snapshot, loading: false, error: reason instanceof Error ? reason.message : "Connexion indisponible." };
      } finally {
        if (isCurrent()) {
          entry.promise = undefined;
          notify(entry);
          if (entry.dirty) await read(url, true, entry.refreshQuery);
        }
      }
    });
    return entry.promise;
  }
  return {
    read, clear,
    snapshot: <T>(url: string) => entryFor(url).snapshot as ResourceSnapshot<T>,
    subscribe(url: string, listener: () => void) {
      const entry = entryFor(url);
      entry.listeners.add(listener);
      return () => { entry.listeners.delete(listener); };
    },
    invalidate() {
      entries.forEach(entry => {
        entry.revision++;
        entry.controller?.abort();
        entry.promise = undefined;
        entry.dirty = false;
        entry.snapshot = { ...entry.snapshot, updatedAt: 0 };
        notify(entry);
      });
    },
    refreshActive() { entries.forEach((entry, url) => { if (entry.listeners.size) void read(url); }); },
  };
}
