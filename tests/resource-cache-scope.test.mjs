import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("clearing the client cache aborts in-flight requests and removes scoped snapshots", async () => {
  const bundle = await build({ entryPoints: ["app/lib/resource-cache.ts"], bundle: true, write: false, platform: "node", format: "esm" });
  const { createResourceCache } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  let resolveResponse;
  const cache = createResourceCache((_url, options) => new Promise(resolve => {
    resolveResponse = resolve;
    options.signal.addEventListener("abort", () => resolve(new Response("aborted", { status: 499 })));
  }));
  const pending = cache.read("/api/portfolio/live");
  await Promise.resolve();
  cache.clear();
  resolveResponse?.(Response.json({ private: true }));
  await pending;
  assert.deepEqual(cache.snapshot("/api/portfolio/live"), { loading: true, error: "", updatedAt: 0 });
});

test("analysis HTTP and response failures retain stale data with typed diagnostics", async () => {
  const bundle = await build({ entryPoints: ["app/lib/resource-cache.ts"], bundle: true, write: false, platform: "node", format: "esm" });
  const { createResourceCache } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  let call = 0;
  const cache = createResourceCache(async () => {
    call += 1;
    if (call === 1) return Response.json({ id: "analysis-1", body: "valid" }, { headers: { "x-request-id": "req-ok" } });
    if (call === 2) return Response.json({ error: "unavailable", code: "storage", stage: "read", requestId: "req-db" }, { status: 500, headers: { "x-request-id": "req-db" } });
    if (call === 3) return new Response("missing", { status: 404 });
    if (call === 4) return new Response("timeout", { status: 504 });
    return new Response("not-json", { status: 200 });
  });
  const url = "/api/analyses/analysis-1";
  await cache.read(url);
  assert.deepEqual(cache.snapshot(url).data, { id: "analysis-1", body: "valid" });
  assert.equal(cache.snapshot(url).diagnostic.code, "ok");
  await cache.read(url, true);
  assert.deepEqual(cache.snapshot(url).data, { id: "analysis-1", body: "valid" });
  assert.equal(cache.snapshot(url).error, "Actualisation indisponible. Réessaie dans un instant.");
  assert.deepEqual({ code: cache.snapshot(url).diagnostic.code, stage: cache.snapshot(url).diagnostic.stage, status: cache.snapshot(url).diagnostic.status, requestId: cache.snapshot(url).diagnostic.requestId }, { code: "storage", stage: "read", status: 500, requestId: "req-db" });
  await cache.read(url, true);
  assert.equal(cache.snapshot(url).diagnostic.code, "analysis_not_found");
  assert.equal(cache.snapshot(url).diagnostic.stage, "lookup");
  assert.equal(cache.snapshot(url).data.id, "analysis-1");
  await cache.read(url, true);
  assert.equal(cache.snapshot(url).diagnostic.code, "timeout");
  assert.equal(cache.snapshot(url).diagnostic.status, 504);
  assert.equal(cache.snapshot(url).data.id, "analysis-1");
  await cache.read(url, true);
  assert.equal(cache.snapshot(url).diagnostic.code, "mapping");
  assert.equal(cache.snapshot(url).diagnostic.causeName, "SyntaxError");
  assert.equal(cache.snapshot(url).data.id, "analysis-1");
});

test("network failures are classified and authorization failures purge every cached response", async () => {
  const bundle = await build({ entryPoints: ["app/lib/resource-cache.ts"], bundle: true, write: false, platform: "node", format: "esm" });
  const { createResourceCache } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  let rejectNetwork = false;
  let deny = false;
  const cache = createResourceCache(async url => {
    if (deny && url.endsWith("/private")) return new Response("{}", { status: 403, headers: { "x-request-id": "req-auth" } });
    if (rejectNetwork) throw new TypeError("private-network-detail");
    return Response.json({ value: url });
  });
  await cache.read("/api/companies/known");
  await cache.read("/private");
  rejectNetwork = true;
  await cache.read("/api/companies/known", true);
  assert.equal(cache.snapshot("/api/companies/known").diagnostic.code, "network");
  assert.equal(cache.snapshot("/api/companies/known").error, "Connexion indisponible.");
  assert.equal(cache.snapshot("/api/companies/known").data.value, "/api/companies/known");
  rejectNetwork = false;
  deny = true;
  await cache.read("/private", true);
  assert.equal(cache.snapshot("/api/companies/known").data, undefined);
  assert.equal(cache.snapshot("/api/companies/known").diagnostic.code, "authorization");
  assert.equal(cache.snapshot("/private").diagnostic.requestId, "req-auth");
});
