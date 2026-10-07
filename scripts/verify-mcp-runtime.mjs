// Non-destructive workerd harness for the built Sites artifact. No production access or credentials.
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fixture, input as writeInput } from "../tests/fixtures/notion-write-harness.mjs";
const data = await fixture();
const root = resolve("dist/server");
const config = JSON.parse(await readFile(`${root}/wrangler.json`, "utf8"));
const mf = new Miniflare({ scriptPath: `${root}/index.js`, modules: true, modulesRoot: root,
  modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"], fallthrough: true }],
  compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
  d1Databases: { DB: "mcp-lot11-isolated" }, d1Persist: false,
  bindings: { OWNER_EMAIL: "owner@example.test", MCP_WRITE_ENABLED: "1", NOTION_TOKEN: "fixture-only" },
  outboundService: async request => {
    assert.equal(new URL(request.url).hostname, "api.notion.com", "No live provider access permitted");
    const body = await request.text();
    return data.options.fetch(request.url, { method: request.method, body: body || undefined });
  }, host: "127.0.0.1", port: 0,
});
const client = new Client({ name: "investment-os-workerd-check", version: "1.0.0" });
const base = { contractVersion: "1.0.0", scope: "demo" };
const headers = { "oai-authenticated-user-id": "local-platform-fixture", "oai-authenticated-user-email": "owner@example.test" };
// These headers simulate Sites dispatch ONLY on this isolated local listener; not an auth bypass for hosting.
try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle")).filter(x => x.endsWith(".sql")).sort()) {
    const sql = (await readFile(`drizzle/${file}`, "utf8")).replaceAll("--> statement-breakpoint", "");
    for (const statement of sql.split(";").filter(x => x.trim())) await db.prepare(statement).run();
  }
  const url = new URL("/mcp", await mf.ready);
  assert.equal((await fetch(url, { method: "POST", body: "{}", headers: { "content-type": "application/json" } })).status, 401);
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
  const list = await client.listTools(); assert.equal(list.tools.length, 9);
  const read = async (name, args) => { const start = performance.now(); const r = await client.callTool({ name, arguments: { ...base, ...args } }); assert.equal(r.structuredContent.status, "completed", name); assert.equal(r.structuredContent.result.status, "ok", name); console.log(`${name}: PASS ${Math.round(performance.now() - start)}ms`); return r.structuredContent.result.data; };
  const resolved = await read("resolve_company", { query: "LUMA" }); assert.equal(resolved.status, "resolved");
  const company = await read("get_company", { id: resolved.candidates[0].companyId }); assert.ok(company);
  const portfolio = await read("get_portfolio", {}); const position = portfolio.positions[0];
  assert.ok(await read("get_position", { id: position.id }));
  assert.ok(await read("get_current_analysis", { companyId: "demo-lumagrid", family: "business" }));
  assert.ok(await read("get_analysis_by_id", { id: company.analyses[0].id }));
  await read("get_quote", { assetId: position.targetId });
  const bad = await client.callTool({ name: "get_company", arguments: { ...base, id: "demo-lumagrid", contractVersion: "2.0.0" } }); assert.equal(bad.structuredContent.error.code, "unsupported_version");
  const forbiddenWrite = await client.callTool({ name: "save_analysis", arguments: { ...base, input: {} } }); assert.equal(forbiddenWrite.structuredContent.error.code, "forbidden");
  const browser = await fetch(url, { method: "POST", headers: { ...headers, origin: url.origin }, body: "{}" }); assert.equal(browser.status, 403);
  const save = await client.callTool({ name: "save_analysis", arguments: { ...base, scope: "personal", input: writeInput() } });
  assert.equal(save.structuredContent.error.code, "forbidden");
  assert.equal(save.structuredContent.error.outcome, "not_started");
  assert.equal(data.creates, 0);
  console.log("workerd: initialization/discovery, identity resolution, 6 demo READ, auth, production WRITE policy (legacy form refused), version, browser boundary PASS");
  console.log(`catalog JSON bytes: ${Buffer.byteLength(JSON.stringify(list))}`);
} finally { await client.close(); await mf.dispose(); data.sql.close(); }
