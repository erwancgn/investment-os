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
