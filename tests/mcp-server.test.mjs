import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { setImmediate as turn } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fixture, input as writeInput } from "./fixtures/notion-write-harness.mjs";
import * as f from "./fixtures/investment-contracts.mjs";

await mkdir(".sites-runtime", { recursive: true });
const bundle = await build({ stdin: { contents: 'export * from "./transports/mcp/server.ts"; export * from "./transports/mcp/sites-auth.ts"; export * from "./core/services/investment-os.ts"; export * from "./adapters/demo/investment-reads.ts";', resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", metafile: true });
await writeFile(".sites-runtime/mcp-test.mjs", bundle.outputFiles[0].text);
const api = await import(`../.sites-runtime/mcp-test.mjs?${Date.now()}`);
const caller = { subject: "fixture-owner", scopes: ["personal", "demo"], permissions: ["investment:read", "investment:write"], writeApproved: true };
const base = { contractVersion: "1.0.0", scope: "personal" };
const request = (name, args = base, overrides = {}) => new Request("http://localhost/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25", ...overrides.headers }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args }, ...overrides.body }) });
const output = async response => { const b = await response.json(); return b.result?.structuredContent ?? b; };
const handler = (core = api.createInvestmentCore({}), identity = caller) => api.createMcpHandler({ authenticate: () => identity, service: () => core });
const call = async (h, name, args = base) => output(await h(request(name, args)));

// Import graph test: this transport can only see Core types/contracts and MCP SDK, never adapters/UI.
test("transport import boundary and canonical discovery schemas", async () => {
  const b = await build({ entryPoints: ["transports/mcp/server.ts"], bundle: true, write: false, platform: "node", format: "esm", packages: "external", metafile: true });
  assert.ok(Object.keys(b.metafile.inputs).every(p => !/^(app|adapters|worker)\//.test(p)));
  const result = await handler()(request("", base, { body: { method: "tools/list", params: {} } }));
  const json = await result.json(); assert.equal(json.result.tools.length, 7);
  assert.equal(json.result.tools.some(t => t.name === "list_analyses"), false);
  for (const tool of json.result.tools) { assert.equal(tool.inputSchema.type, "object"); assert.ok(tool.inputSchema.definitions); assert.equal(tool.annotations.readOnlyHint, tool.name !== "save_analysis"); }
});

test("unknown tools, invalid versions, invalid schemas, output schemas and scope", async () => {
  const h = handler();
  const unknown = await (await h(request("list_analyses"))).json(); assert.equal(unknown.error.code, -32602);
  assert.equal((await call(h, "get_company", { ...base, id: "c", contractVersion: "9" })).error.code, "unsupported_version");
  for (const bad of [{ ...base, id: 3 }, { ...base, id: "c", callerId: "owner" }, { ...base, id: "c", scope: "all" }]) assert.equal((await call(h, "get_company", bad)).error.code, "invalid_input");
  const badCore = handler({ getCompany: async () => ({ status: "ok", data: null }) });
  const badOutput = await call(badCore, "get_company", { ...base, id: "c" }); assert.equal(badOutput.error.code, "invalid_input"); assert.equal(badOutput.error.outcome, "unknown");
});

test("auth excludes payload identity, cookies, bypass credentials and browser writes", async () => {
  assert.equal((await handler(undefined, null)(request("get_company", { ...base, id: "c" }))).status, 401);
  const identityRequest = new Request("https://site/mcp", { headers: { "oai-authenticated-user-id": "user", "oai-authenticated-user-email": "owner@example.test" } });
  const c = api.authenticateSitesMcp(identityRequest, { OWNER_EMAIL: "owner@example.test" });
  assert.deepEqual(c.permissions, ["investment:read"]); assert.equal(c.writeApproved, false);
  assert.equal(api.authenticateSitesMcp(new Request("https://site/mcp", { headers: { cookie: "investment-os-scope=personal", "OAI-Sites-Authorization": "Bearer fixture-only" } }), {}), null);
  assert.equal((await handler()(request("save_analysis", { ...base, input: writeInput() }, { headers: { origin: "http://localhost" } }))).status, 403);
  const other = api.authenticateSitesMcp(identityRequest, { OWNER_EMAIL: "other@example.test", MCP_WRITE_ENABLED: "1", MCP_WRITE_DELEGATED: "1" });
  assert.deepEqual(other.scopes, ["demo"]); assert.deepEqual(other.permissions, ["investment:read"]);
});

test("Sites test WRITE requires all flags and transport fence admits only configured run IDs", async () => {
  const identityRequest = new Request("https://site/mcp", { headers: { "oai-authenticated-user-id": "user", "oai-authenticated-user-email": "owner@example.test" } });
  const flags = { OWNER_EMAIL: "owner@example.test", MCP_WRITE_ENABLED: "1", MCP_WRITE_DELEGATED: "1", MCP_WRITE_TEST_RUN_IDS: "allowed-run" };
  for (const missing of ["MCP_WRITE_ENABLED", "MCP_WRITE_DELEGATED", "MCP_WRITE_TEST_RUN_IDS"]) {
    const restricted = api.authenticateSitesMcp(identityRequest, { ...flags, [missing]: undefined });
    assert.deepEqual(restricted.permissions, ["investment:read"]);
    assert.equal(restricted.writeApproved, false);
  }
  const identity = api.authenticateSitesMcp(identityRequest, { OWNER_EMAIL: "owner@example.test", MCP_WRITE_ENABLED: "1", MCP_WRITE_DELEGATED: "1", MCP_WRITE_TEST_RUN_IDS: "allowed-run" });
  assert.deepEqual(identity.permissions, ["investment:read", "investment:write"]);
  assert.equal(identity.writeApproved, true);
  const authorizedFixture = { ...identity, permissions: ["investment:read", "investment:write"], writeApproved: true };
  let calls = 0;
  const core = { saveAnalysis: async () => { calls++; throw new Error("write reached"); } };
  const denied = await call(handler(core, authorizedFixture), "save_analysis", { ...base, input: { ...writeInput(), runId: "other-run" } });
  assert.equal(denied.error.code, "forbidden"); assert.equal(denied.error.outcome, "not_started"); assert.equal(calls, 0);
  await call(handler(core, authorizedFixture), "save_analysis", { ...base, input: { ...writeInput(), runId: "allowed-run" } });
  assert.equal(calls, 1);
});

test("permissions, scope isolation, mutation confirmation and unauthorized never reach Core", async () => {
  let calls = 0; const core = { saveAnalysis: async () => { calls++; throw new Error("must not happen"); }, getCompany: async () => { calls++; throw new Error("must not happen"); } };
  for (const [identity, args, code] of [[{ ...caller, scopes: ["demo"] }, { ...base, id: "c" }, "forbidden"], [{ ...caller, permissions: ["investment:read"] }, { ...base, input: writeInput() }, "forbidden"], [caller, { ...base, scope: "demo", input: writeInput() }, "forbidden"], [{ ...caller, writeApproved: false }, { ...base, input: writeInput() }, "confirmation_required"]]) {
    const name = args.input ? "save_analysis" : "get_company";
    const response = await (await handler(core, identity)(request(name, args))).json();
    assert.equal(response.result.structuredContent.error.code, code);
    // Hosted error consumers can discard structuredContent: the text must still
    // prove the denial before Core, without echoing the write intent or identity.
    const textOnly = JSON.parse(response.result.content[0].text);
    assert.equal(response.result.isError, true);
    assert.equal(textOnly.error.code, code);
    assert.equal(textOnly.error.outcome, "not_started");
    assert.equal(textOnly.diagnostics[0].code, code === "forbidden" ? "scope_permission" : "mutation_confirmation");
    assert.equal(response.result.content[0].text.includes(identity.subject), false);
    if (args.input) assert.equal(response.result.content[0].text.includes(args.input.runId), false);
  }
  assert.equal(calls, 0);
});

test("all seven mappings execute existing Core with exact arguments and preserve diagnostics", async () => {
  const seen = [];
  const doc = writeInput().analysis; doc.header.id = "analysis-1"; doc.header.companyIds = ["company-1"];
  const ports = {
    readCompany: async id => { seen.push(["getCompany", id]); return f.companyPreview(); },
    readPortfolio: async opts => { seen.push(["getPortfolio", opts]); return f.portfolio(); },
    readPosition: async (id, opts) => { seen.push(["getPosition", id, opts]); return f.position(); },
    readCurrentContext: async (id, family) => { seen.push(["getCurrentAnalysis", id, family]); return { companyId: id, family, candidates: [], explicitCurrentIds: [] }; },
    readAnalysis: async id => { seen.push(["getAnalysisById", id]); return doc; },
    readQuote: async (id, opts) => { seen.push(["getQuote", id, opts]); return f.quote(); },
    writeAnalysis: async input => { seen.push(["saveAnalysis", input]); return { schemaVersion: "1.0.0", status: "persisted", analysisId: doc.header.id, runId: input.runId, revision: "new", persisted: true, promoted: false, verified: false, diagnostics: [{ code: "fixture_safe", message: "Safe diagnostic", severity: "warning" }] }; },
  };
  const h = handler(api.createInvestmentCore(ports)); const opts = { cacheOnly: true };
  for (const [name, args, expected] of [["get_company", { id: "company-1" }, ["getCompany", "company-1"]], ["get_portfolio", { options: opts }, ["getPortfolio", opts]], ["get_position", { id: "position-1", options: opts }, ["getPosition", "position-1", opts]], ["get_current_analysis", { companyId: "company-1", family: "business" }, ["getCurrentAnalysis", "company-1", "business"]], ["get_analysis_by_id", { id: "analysis-1" }, ["getAnalysisById", "analysis-1"]], ["get_quote", { assetId: "asset-1", options: opts }, ["getQuote", "asset-1", opts]], ["save_analysis", { input: { ...writeInput(), analysis: doc, companyIds: ["company-1"], runId: "unchanged-run", expectedRevision: "unchanged-revision" } }, null]]) {
    const out = await call(h, name, { ...base, ...args }); assert.equal(out.result.status, "ok", name);
    if (expected) assert.deepEqual(seen.at(-1), expected);
    else { assert.equal(seen.at(-1)[0], "saveAnalysis"); assert.equal(seen.at(-1)[1].runId, "unchanged-run"); assert.equal(seen.at(-1)[1].expectedRevision, "unchanged-revision"); assert.equal(out.result.data.diagnostics[0].message, "Safe diagnostic"); }
  }
});

test("Core errors are typed and raw dependency exceptions never escape", async () => {
  const h = handler(api.createInvestmentCore({ readQuote: async () => { throw Object.assign(new Error("private SQL/token fixture"), { code: "stale_request" }); } }));
  const out = await call(h, "get_quote", { ...base, assetId: "asset-1" }); assert.equal(out.result.error.code, "stale_request"); assert.equal(JSON.stringify(out).includes("SQL"), false);
  const crashed = await call(handler({ getCompany: async () => { throw new Error("raw DB token"); } }), "get_company", { ...base, id: "c" }); assert.equal(crashed.error.code, "network"); assert.equal(JSON.stringify(crashed).includes("raw DB"), false);
});

test("2 MiB streamed/declarative requests and 4 MiB output limits fail without truncation", async () => {
  const h = handler();
  const big = request("get_company", { ...base, id: "x", extra: "x".repeat(2097152 + 4096) }); assert.equal((await h(big)).status, 413);
  assert.equal((await h(request("get_company", base, { headers: { "content-length": "2101249" } }))).status, 413);
  const company = f.companyPreview(); company.monitoringStatus = "x".repeat(4194304);
  const out = await call(handler(api.createInvestmentCore({ readCompany: async () => company })), "get_company", { ...base, id: "company-1" }); assert.equal(out.error.code, "limit_exceeded"); assert.equal(out.error.outcome, "unknown");
});

test("READ and WRITE 30s deadlines preserve unknown outcome and fence pending WRITE", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let resolveWrite; let attempts = 0; const retained = [];
    const core = { getCompany: async () => new Promise(() => {}), saveAnalysis: async () => { attempts++; return new Promise(resolve => { resolveWrite = resolve; }); } };
    const h = api.createMcpHandler({ authenticate: () => caller, service: () => core, waitUntil: task => retained.push(task) });
    const read = h(request("get_company", { ...base, id: "c" })); await turn(); t.mock.timers.tick(30001); await turn(); assert.equal((await output(await read)).error.code, "timeout");
    const abort = new AbortController();
    const write = h(new Request(request("save_analysis", { ...base, input: writeInput() }), { signal: abort.signal }));
    await turn(); abort.abort(); await turn();
    // A disconnected caller does not cancel a port or release its mutation fence.
    assert.equal((await call(h, "save_analysis", { ...base, input: writeInput() })).error.code, "rate_limit");
    let responded = false; void write.then(() => { responded = true; });
    t.mock.timers.tick(29999); await turn(); assert.equal(responded, false);
    t.mock.timers.tick(1); await turn(); const out = await output(await write); assert.equal(out.error.code, "timeout"); assert.equal(out.error.outcome, "unknown");
    assert.equal((await call(h, "save_analysis", { ...base, input: writeInput() })).error.code, "rate_limit"); assert.equal(attempts, 1);
    assert.equal(out.error.retryable, false); assert.equal(retained.length, 2);
    let settled = false; void retained[1].then(() => { settled = true; });
    await turn(); assert.equal(settled, false);
    resolveWrite({ invalid: true }); await retained[1]; assert.equal(settled, true);
    // After the original task settles a new explicit attempt may enter.
    core.saveAnalysis = async () => { attempts++; return { invalid: true }; };
    assert.equal((await call(h, "save_analysis", { ...base, input: writeInput() })).error.code, "invalid_input");
    assert.equal(attempts, 2);
  } finally { t.mock.timers.reset(); }
});

test("demo six reads use snapshot Core and never invoke personal service", async () => {
  const service = api.createDemoInvestmentService(); const p = await service.getPortfolio(); const position = p.data.positions[0];
  let personal = 0; const h = api.createMcpHandler({ authenticate: () => ({ ...caller, scopes: ["demo"] }), service: scope => { if (scope !== "demo") personal++; return service; } });
  for (const [name, args] of [["get_company", { id: "demo-lumagrid" }], ["get_portfolio", {}], ["get_position", { id: position.id }], ["get_current_analysis", { companyId: "demo-lumagrid", family: "business" }], ["get_analysis_by_id", { id: "demo-analysis-luma-business" }], ["get_quote", { assetId: position.targetId }]]) assert.equal((await call(h, name, { ...base, scope: "demo", ...args })).result.status, "ok", name);
  assert.equal(personal, 0); assert.equal((await call(h, "get_company", { ...base, id: "company-1" })).error.code, "forbidden");
});

// A real loopback HTTP listener + official MCP client, actual Core/adapter/writer, local SQLite and
// the existing isolated Notion fixture. No live credentials and no mutation of real data.
test("local runtime: SDK client initialize/discover, real adapter WRITE receipts/replay/conflict", async () => {
  for (const [flags, status] of [[{}, "verified"], [{ promotionFail: true }, "promotion_pending"], [{ failFinalRead: true }, "partial"], [{}, "persisted"]]) {
    const data = await fixture(flags); const token = randomBytes(32).toString("hex");
    const h = api.createMcpHandler({ authenticate: r => r.headers.get("authorization") === `Bearer ${token}` ? caller : null, service: scope => scope === "demo" ? api.createDemoInvestmentService() : data.api.createInvestmentService(data.db, data.options) });
    const http = createServer(async (req, res) => {
      try { const chunks = []; for await (const c of req) chunks.push(c); const response = await h(new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers, body: Buffer.concat(chunks), duplex: "half" })); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); }
      catch { res.writeHead(500); res.end(); }
    });
    await new Promise(resolve => http.listen(0, "127.0.0.1", resolve));
    const url = new URL(`http://127.0.0.1:${http.address().port}/mcp`);
    const client = new Client({ name: "investment-os-test", version: "1.0.0" });
    try {
      const unauthenticated = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert.equal(unauthenticated.status, 401);
      await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
      assert.equal((await client.listTools()).tools.length, 7);
      const intent = writeInput(); if (status === "persisted") intent.analysis.header.status = "Draft";
      const one = await client.callTool({ name: "save_analysis", arguments: { ...base, input: intent } });
      assert.equal(one.structuredContent.result.data.status, status); assert.equal(data.creates, 1);
      const two = await client.callTool({ name: "save_analysis", arguments: { ...base, input: intent } }); assert.equal(data.creates, 1); if (status !== "partial") assert.equal(two.structuredContent.result.data.status, status); else assert.equal(two.structuredContent.result.status, "error");
      const conflict = await client.callTool({ name: "save_analysis", arguments: { ...base, input: { ...intent, analysis: { ...intent.analysis, content: { ...intent.analysis.content, blocks: [] } } } } }); assert.equal(conflict.structuredContent.result.error.code, "stale_request"); assert.equal(data.creates, 1);
      for (const [name, args] of [["get_company", { id: "demo-lumagrid" }], ["get_portfolio", {}], ["get_current_analysis", { companyId: "demo-lumagrid", family: "business" }], ["get_analysis_by_id", { id: "demo-analysis-luma-business" }]]) assert.equal((await client.callTool({ name, arguments: { ...base, scope: "demo", ...args } })).structuredContent.result.status, "ok");
    } finally { await client.close(); await new Promise(resolve => http.close(resolve)); data.sql.close(); }
  }
});


test("completed transient READ retries at most twice; WRITE never retries a Core error", async () => {
  let reads = 0, writes = 0;
  const h = handler(api.createInvestmentCore({ readQuote: async () => { if (++reads === 1) throw { code: "network" }; return f.quote(); }, writeAnalysis: async () => { writes++; throw { code: "network" }; } }));
  assert.equal((await call(h, "get_quote", { ...base, assetId: "asset-1" })).result.status, "ok"); assert.equal(reads, 2);
  assert.equal((await call(h, "save_analysis", { ...base, input: writeInput() })).result.error.code, "network"); assert.equal(writes, 1);
});

test("READ backoff cannot start a second Core call after its deadline", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let resolveRead; let attempts = 0;
    const h = handler(api.createInvestmentCore({ readQuote: async () => { attempts++; return new Promise(resolve => { resolveRead = resolve; }); } }));
    const pending = call(h, "get_quote", { ...base, assetId: "asset-1" });
    await turn(); t.mock.timers.tick(29900);
    resolveRead(Promise.reject({ code: "network" })); await turn();
    t.mock.timers.tick(101); await turn();
    assert.equal((await pending).error.code, "timeout");
    t.mock.timers.tick(250); await turn(); assert.equal(attempts, 1);
  } finally { t.mock.timers.reset(); }
});

test("2 MiB tool arguments are accepted independently of JSON-RPC framing", async () => {
  let calls = 0;
  const h = handler(api.createInvestmentCore({ writeAnalysis: async intent => { calls++; return { schemaVersion: "1.0.0", status: "persisted", analysisId: "assigned", runId: intent.runId, revision: null, persisted: true, promoted: false, verified: false, diagnostics: [] }; } }));
  const args = { ...base, input: writeInput() }; args.input.analysis.header.title = "";
  args.input.analysis.header.title = "x".repeat(2097152 - Buffer.byteLength(JSON.stringify(args)));
  assert.equal(Buffer.byteLength(JSON.stringify(args)), 2097152);
  assert.equal((await call(h, "save_analysis", args)).result.data.status, "persisted");
  args.input.analysis.header.title += "x";
  assert.equal((await call(h, "save_analysis", args)).error.code, "limit_exceeded"); assert.equal(calls, 1);
});
