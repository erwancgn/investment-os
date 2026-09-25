import { refreshResource, resourceSnapshot } from "./client-resource";

const defaultBasketUrl = "/api/theme-baskets?dimension=theme&period=1y";

type WarmupDependencies = {
  fetcher?: typeof fetch;
  isVisible?: () => boolean;
  portfolioBusy?: () => boolean;
  wait?: (milliseconds: number) => Promise<void>;
  waitForVisible?: () => Promise<void>;
  refreshDefault?: () => Promise<void>;
};

export function createThemeBasketWarmup(dependencies: WarmupDependencies = {}) {
  const fetcher = dependencies.fetcher ?? fetch;
  const isVisible = dependencies.isVisible ?? (() => document.visibilityState === "visible");
  const portfolioBusy = dependencies.portfolioBusy ?? (() => {
    const portfolio = resourceSnapshot<{ refreshPending?: boolean }>("/api/portfolio/live");
    return portfolio.loading || portfolio.data?.refreshPending === true;
  });
  const wait = dependencies.wait ?? (milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)));
  const waitForVisible = dependencies.waitForVisible ?? (() => new Promise<void>(resolve => {
    if (isVisible()) return resolve();
    const resume = () => {
      if (!isVisible()) return;
      document.removeEventListener("visibilitychange", resume);
      resolve();
    };
    document.addEventListener("visibilitychange", resume);
  }));
  const refreshDefault = dependencies.refreshDefault ?? (() => refreshResource(defaultBasketUrl));
  let active: Promise<void> | undefined;

  const run = async (force: boolean) => {
    if (!force) {
      const current = await fetcher(defaultBasketUrl, { cache: "no-store" });
      if (!current.ok) throw new Error("Lecture du cache des paniers indisponible.");
      const cached = await current.json() as { refreshNeeded?: boolean };
      if (!cached.refreshNeeded) return;
    }
    let batch = 0;
    while (true) {
      if (!isVisible()) await waitForVisible();
      if (portfolioBusy()) {
        await wait(700);
        continue;
      }
      const response = await fetcher(`${defaultBasketUrl}&refresh=1&batch=${batch}${force ? "&force=1" : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Actualisation du cache des paniers indisponible.");
      const body = await response.json() as { refreshProgress?: { nextBatch: number; totalBatches: number; complete: boolean; running?: boolean } };
      const progress = body.refreshProgress;
      if (!progress || progress.complete) break;
      if (progress.running) {
        await wait(700);
        continue;
      }
      batch = progress.nextBatch;
      await wait(80);
    }
    await refreshDefault();
  };

  const start = (force = false): Promise<void> => {
    if (active) return force ? active.then(() => start(true)) : active;
    active = run(force).finally(() => { active = undefined; });
    return active;
  };
  return start;
}

const warm = createThemeBasketWarmup();
let scheduled = false;

export function refreshThemeBasketCache(force = false) { return warm(force); }

export function scheduleThemeBasketWarmup() {
  if (scheduled) return;
  scheduled = true;
  const start = () => { scheduled = false; void warm().catch(() => undefined); };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(start, { timeout: 3000 });
  else window.setTimeout(start, 1200);
}
