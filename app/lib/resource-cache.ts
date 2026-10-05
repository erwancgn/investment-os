export type ResourceDiagnostic = {
  code: string;
  stage: string;
  status?: number;
  requestId?: string;
  durationMs?: number;
  causeName?: string;
};
export type ResourceSnapshot<T> = {
  data?: T;
  loading: boolean;
  error: string;
  updatedAt: number;
  diagnostic?: ResourceDiagnostic;
};
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
  function clear(error = "", diagnostic?: ResourceDiagnostic) {
    epoch++;
    entries.forEach(entry => {
      entry.controller?.abort();
      entry.promise = undefined;
      entry.dirty = false;
      entry.snapshot = error
        ? { ...emptyResource, loading: false, error, ...(diagnostic ? { diagnostic } : {}) }
        : emptyResource;
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
      const startedAt = Date.now();
      let response: Response | undefined;
      try {
        response = await fetcher(url + (refreshQuery ? `${url.includes("?") ? "&" : "?"}refresh=1${refreshQuery === "force" ? "&force=1" : ""}` : ""), { cache: "no-store", signal: controller.signal });
        if (!isCurrent()) return;
        const requestId = response.headers.get("x-request-id") ?? undefined;
        if (response.status === 401 || response.status === 403) {
          clear("Session expirée. Reconnecte-toi pour actualiser les données.", {
            code: "authorization",
            stage: "auth",
            status: response.status,
            requestId,
            durationMs: Date.now() - startedAt,
          });
          return;
        }
        if (!response.ok) {
          let serverError: { code?: unknown; stage?: unknown; requestId?: unknown } | undefined;
          try {
            serverError = await response.clone().json() as typeof serverError;
          } catch {
            // Non-JSON HTTP errors use the status.
          }
          const isAnalysis = url.startsWith("/api/analyses/");
          let code = "http";
          if (typeof serverError?.code === "string") code = serverError.code;
          else if (response.status === 404 && isAnalysis) code = "analysis_not_found";
          else if (response.status === 408 || response.status === 504) code = "timeout";
          let stage = "http";
          if (typeof serverError?.stage === "string") stage = serverError.stage;
          else if (code === "analysis_not_found") stage = "lookup";
          else if (code === "timeout") stage = "response";
          let message = "Actualisation indisponible. Réessaie dans un instant.";
          if (code === "analysis_not_found") message = "Analyse introuvable.";
          else if (code === "timeout") message = "La lecture a expiré. Réessaie dans un instant.";
          const failure = Object.assign(new Error(message), {
            diagnostic: {
              code,
              stage,
              status: response.status,
              requestId: requestId ?? (typeof serverError?.requestId === "string" ? serverError.requestId : undefined),
              durationMs: Date.now() - startedAt,
            } satisfies ResourceDiagnostic,
          });
          throw failure;
        }
        let data: unknown;
        try {
          data = await response.json();
        } catch (cause) {
          throw Object.assign(new Error("La réponse reçue est invalide."), {
            diagnostic: {
              code: "mapping",
              stage: "response-parse",
              status: response.status,
              requestId,
              durationMs: Date.now() - startedAt,
              causeName: cause instanceof Error ? cause.name : undefined,
            } satisfies ResourceDiagnostic,
          });
        }
        if (isCurrent() && !entry.dirty) {
          entry.snapshot = {
            data,
            loading: false,
            error: "",
            updatedAt: Date.now(),
            diagnostic: {
              code: "ok",
              stage: "complete",
              status: response.status,
              requestId,
              durationMs: Date.now() - startedAt,
            },
          };
        }
      } catch (reason) {
        if (isCurrent()) {
          const causeName = reason instanceof Error ? reason.name : undefined;
          const carried = reason && typeof reason === "object" && "diagnostic" in reason
            ? (reason as { diagnostic?: ResourceDiagnostic }).diagnostic
            : undefined;
          const timedOut = causeName === "TimeoutError" || causeName === "AbortError";
          const code = carried?.code ?? (timedOut ? "timeout" : "network");
          const stage = carried?.stage ?? "request";
          let error = "Connexion indisponible.";
          if (carried?.code) error = reason instanceof Error ? reason.message : "Lecture indisponible.";
          else if (timedOut) error = "La lecture a expiré. Réessaie dans un instant.";
          entry.snapshot = {
            ...entry.snapshot,
            loading: false,
            error,
            diagnostic: {
              ...carried,
              code,
              stage,
              status: carried?.status ?? response?.status,
              requestId: carried?.requestId ?? response?.headers.get("x-request-id") ?? undefined,
              durationMs: carried?.durationMs ?? Date.now() - startedAt,
              causeName: carried?.causeName ?? causeName,
            },
          };
        }
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
