import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { setImmediate as turn } from "node:timers/promises";
import { ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fixture, input as writeInput } from "./fixtures/notion-write-harness.mjs";
import * as f from "./fixtures/investment-contracts.mjs";

await mkdir(".sites-runtime", { recursive: true });
const bundle = await build({ stdin: { contents: 'export * from "./transports/mcp/server.ts"; export * from "./transports/mcp/sites-auth.ts"; export * from "./core/services/investment-os.ts"; export * from "./adapters/demo/investment-reads.ts"; export * from "./transports/mcp/site-campaign.ts";', resolveDir: process.cwd() }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", metafile: true });
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
  const json = await result.json(); assert.equal(json.result.tools.length, 8);
  assert.equal(json.result.tools.some(t => t.name === "list_analyses"), false);
  for (const tool of json.result.tools) { assert.equal(ToolSchema.safeParse(tool).success,true); assert.equal(tool.outputSchema.type,"object"); assert.equal(tool.inputSchema.type, "object"); assert.equal(JSON.stringify(tool.inputSchema).includes('"$ref"'), false); assert.equal(tool.annotations.readOnlyHint, tool.name !== "save_analysis"); }
  // Contract 1.1: save_analysis publishes only the report form (the 1.0 object form stays accepted, unpublished).
  const save = json.result.tools.find(t => t.name === "save_analysis").inputSchema;
  const input = save.properties.input;
  assert.deepEqual(input.required.slice().sort(), ["companyId", "confidence", "date", "format", "kind", "reportMarkdown", "runId", "status", "summary", "title", "verdict"].sort());
  assert.deepEqual(input.properties.format, { const: "report", description: input.properties.format.description });
  assert.equal("analysis" in input.properties, false);
  assert.ok(input.properties.reportMarkdown.description.includes("[E:id]"));
  assert.ok(Buffer.byteLength(JSON.stringify(save)) < 20_000, `save_analysis input ${Buffer.byteLength(JSON.stringify(save))} bytes`);
});

test("unknown tools, invalid versions, invalid schemas, output schemas and scope", async () => {
  const h = handler();
  const unknown = await (await h(request("list_analyses"))).json(); assert.equal(unknown.error.code, -32602);
  assert.equal((await call(h, "get_company", { ...base, id: "c", contractVersion: "9" })).error.code, "unsupported_version");
  for (const bad of [{ ...base, id: 3 }, { ...base, id: "c", callerId: "owner" }, { ...base, id: "c", scope: "all" }]) assert.equal((await call(h, "get_company", bad)).error.code, "invalid_input");
  const badCore = handler({ getCompany: async () => ({ status: "ok", data: null }) });
  const badOutput = await call(badCore, "get_company", { ...base, id: "c" }); assert.equal(badOutput.error.code, "invalid_input"); assert.equal(badOutput.error.outcome, "unknown"); assert.deepEqual(badOutput.diagnostics, [{ code: "output_schema", message: "Résultat transport invalide.", severity: "error", path: "output" }]);
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

test("Sites WRITE is release-closed; even a fixture allowlist cannot bypass the campaign policy", async () => {
  const identityRequest = new Request("https://site/mcp", { headers: { "oai-authenticated-user-id": "user", "oai-authenticated-user-email": "owner@example.test" } });
  const flags = { OWNER_EMAIL: "owner@example.test", MCP_WRITE_ENABLED: "1", MCP_WRITE_DELEGATED: "1", MCP_WRITE_TEST_RUN_IDS: "allowed-run" };
  for (const missing of ["MCP_WRITE_ENABLED", "MCP_WRITE_DELEGATED", "MCP_WRITE_TEST_RUN_IDS"]) {
    const restricted = api.authenticateSitesMcp(identityRequest, { ...flags, [missing]: undefined });
    assert.deepEqual(restricted.permissions, ["investment:read"]);
    assert.equal(restricted.writeApproved, false);
  }
  const identity = api.authenticateSitesMcp(identityRequest, { OWNER_EMAIL: "owner@example.test", MCP_WRITE_ENABLED: "1", MCP_WRITE_DELEGATED: "1", MCP_WRITE_TEST_RUN_IDS: "allowed-run" });
  assert.deepEqual(identity.permissions, ["investment:read"]);
  assert.equal(identity.writeApproved, false);
  let closedCalls = 0;
  const closedOwner = api.authenticateSitesMcp(identityRequest, { ...flags, MCP_WRITE_TEST_RUN_IDS: "FV-SU-20261006-LOT13-E2E" });
  const closedOutput = await call(handler({ saveAnalysis: async () => { closedCalls++; throw new Error("closed write reached Core"); } }, closedOwner), "save_analysis", { ...base, input: writeInput() });
  assert.equal(closedOutput.error.code, "forbidden"); assert.equal(closedOutput.error.outcome, "not_started"); assert.equal(closedCalls, 0);
  const authorizedFixture = { ...identity, permissions: ["investment:read", "investment:write"], writeApproved: true };
  let calls = 0;
  const core = { saveAnalysis: async () => { calls++; throw new Error("write reached"); } };
  const denied = await call(handler(core, authorizedFixture), "save_analysis", { ...base, input: { ...writeInput(), runId: "other-run" } });
  assert.equal(denied.error.code, "forbidden"); assert.equal(denied.error.outcome, "not_started"); assert.equal(calls, 0);
  const allowlistedButUnmapped = await call(handler(core, authorizedFixture), "save_analysis", { ...base, input: { ...writeInput(), runId: "allowed-run" } });
  assert.equal(allowlistedButUnmapped.error.code, "forbidden"); assert.equal(calls, 0);
});

test("Sites campaign dispatch is exact, Draft-only, new-only, and expires before Core", async () => {
  const runId = "FV-SU-20261006-LOT13-E2E";
  const allowedWriteRunIds = [runId, "ER-MU-20261006-LOT13-E2E", "FA-GOOGL-20261006-LOT13-E2E"];
  const identity = { ...caller, allowedWriteRunIds };
  let calls = 0;
  const core = api.createInvestmentCore({ writeAnalysis: async intent => { calls++; return { schemaVersion: "1.0.0", status: "persisted", analysisId: "assigned-analysis", runId: intent.runId, revision: "2026-10-06T12:00:00Z", persisted: true, promoted: false, verified: false, diagnostics: [] }; } });
  const campaignInput = (campaignRunId = runId, companyId = "3b337ea7af3581ca97c4f048f9d52b1c", family = "business") => {
    const intent = writeInput();
    intent.runId = campaignRunId;
    intent.companyIds = [companyId];
    intent.analysis.header.companyIds = [companyId];
    intent.analysis.header.status = "Draft";
    intent.analysis.kind = family;
    intent.analysis.header.family = family;
    intent.analysis.header.agent = family === "earnings" ? "Earnings" : family === "cio_memo" ? "Investment Memo" : `${family[0].toUpperCase()}${family.slice(1)} Analyst`;
    if (family === "earnings") { delete intent.analysis.score; intent.analysis.earningsReview = { fiscalPeriod: null, guidance: null, guidanceVsConsensus: null, confidence: null, refreshes: [] }; }
    if (family === "cio_memo") { delete intent.analysis.score; intent.analysis.handoffSummary = null; }
    return intent;
  };
  const previousNow = Date.now;
  Date.now = () => Date.parse("2026-10-06T12:00:00Z");
  try {
    const h = handler(core, identity);
    const accepted = await call(h, "save_analysis", { ...base, input: campaignInput() });
    assert.equal(accepted.result?.status, "ok", JSON.stringify(accepted));
    assert.equal(calls, 1, "the exact authorized Draft reaches the fake Core");
    for (const [id, company, family] of [
      ["ER-MU-20261006-LOT13-E2E", "3b537ea7af3581bd9d9bd65dcfe03d97", "earnings"],
      ["FA-GOOGL-20261006-LOT13-E2E", "3b337ea7af35819e8bd8f12ea7fb5dc4", "cio_memo"],
    ]) assert.equal((await call(h, "save_analysis", { ...base, input: campaignInput(id, company, family) })).result.status, "ok");
    assert.equal(calls, 3, "each exact company/family campaign has a nominal path");

    const wrongCompany = campaignInput();
    wrongCompany.companyIds = ["3b537ea7af3581bd9d9bd65dcfe03d97"];
    wrongCompany.analysis.header.companyIds = [...wrongCompany.companyIds];
    const wrongFamily = campaignInput();
    wrongFamily.analysis.kind = "generic";
    wrongFamily.analysis.header.family = "generic";
    delete wrongFamily.analysis.score;
    const validated = campaignInput(); validated.analysis.header.status = "Validated";
    const revisionUpdate = { ...campaignInput(), expectedRevision: "2026-10-06T11:00:00Z" };
    const differentRun = { ...campaignInput(), runId: "OTHER-LOT13-RUN" };
    for (const input of [wrongCompany, wrongFamily, validated, revisionUpdate, differentRun]) {
      const denied = await call(h, "save_analysis", { ...base, input });
      assert.equal(denied.error.code, "forbidden");
      assert.equal(denied.error.outcome, "not_started");
    }
    assert.equal(calls, 3, "invalid campaign intents never reach Core");

    Date.now = () => Date.parse("2026-10-06T14:00:00Z");
    const expired = await call(h, "save_analysis", { ...base, input: campaignInput() });
    assert.equal(expired.error.code, "forbidden");
    assert.equal(calls, 3, "expired campaign never reaches Core");

    Date.now = () => Date.parse("2026-10-06T12:00:00Z");
    const noAllowlist = await call(handler(core, { ...identity, allowedWriteRunIds: [] }), "save_analysis", { ...base, input: campaignInput() });
    assert.equal(noAllowlist.error.code, "forbidden");
    assert.equal(calls, 3, "missing allowlist never reaches Core");
  } finally { Date.now = previousNow; }
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

test("all eight mappings execute existing Core with exact arguments and preserve diagnostics", async () => {
  const seen = [];
  const doc = writeInput().analysis; doc.header.id = "analysis-1"; doc.header.companyIds = ["company-1"];
  const ports = {
    readCompanyIdentities: async () => { seen.push(["resolveCompany"]); return [{ companyId: "company-1", canonicalName: "Microsoft", ticker: "MSFT", exchange: "NASDAQ", assetId: null, aliases: [] }]; },
    readCompany: async id => { seen.push(["getCompany", id]); return f.companyPreview(); },
    readPortfolio: async opts => { seen.push(["getPortfolio", opts]); return f.portfolio(); },
    readPosition: async (id, opts) => { seen.push(["getPosition", id, opts]); return f.position(); },
    readCurrentContext: async (id, family) => { seen.push(["getCurrentAnalysis", id, family]); return { companyId: id, family, candidates: [], explicitCurrentIds: [] }; },
    readAnalysis: async id => { seen.push(["getAnalysisById", id]); return doc; },
    readQuote: async (id, opts) => { seen.push(["getQuote", id, opts]); return f.quote(); },
    writeAnalysis: async input => { seen.push(["saveAnalysis", input]); return { schemaVersion: "1.0.0", status: "persisted", analysisId: doc.header.id, runId: input.runId, revision: "new", persisted: true, promoted: false, verified: false, diagnostics: [{ code: "fixture_safe", message: "Safe diagnostic", severity: "warning" }] }; },
  };
  const h = handler(api.createInvestmentCore(ports)); const opts = { cacheOnly: true };
  for (const [name, args, expected] of [["resolve_company", { query: "Microsoft" }, ["resolveCompany"]], ["get_company", { id: "company-1" }, ["getCompany", "company-1"]], ["get_portfolio", { options: opts }, ["getPortfolio", opts]], ["get_position", { id: "position-1", options: opts }, ["getPosition", "position-1", opts]], ["get_current_analysis", { companyId: "company-1", family: "business" }, ["getCurrentAnalysis", "company-1", "business"]], ["get_analysis_by_id", { id: "analysis-1" }, ["getAnalysisById", "analysis-1"]], ["get_quote", { assetId: "asset-1", options: opts }, ["getQuote", "asset-1", opts]], ["save_analysis", { input: { ...writeInput(), analysis: doc, companyIds: ["company-1"], runId: "unchanged-run", expectedRevision: "unchanged-revision" } }, null]]) {
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

test("text-only hosted consumers receive typed Core errors without dependency secrets", async () => {
  const h = handler(api.createInvestmentCore({ readQuote: async () => { throw Object.assign(new Error("private SQL/token fixture"), { code: "stale_request" }); } }));
  const response = await (await h(request("get_quote", { ...base, assetId: "asset-1" }))).json();
  assert.equal(response.result.isError, true);
  assert.deepEqual(JSON.parse(response.result.content[0].text), response.result.structuredContent);
  assert.equal(JSON.parse(response.result.content[0].text).result.error.code, "stale_request");
  assert.equal(response.result.content[0].text.includes("SQL/token"), false);
});

test("fiscal labels in canonical asOf fail Core validation before the writer", async () => {
  let writes = 0;
  const core = api.createInvestmentCore({ writeAnalysis: async input => { writes++; return { schemaVersion: "1.0.0", status: "persisted", analysisId: input.analysis.header.id, runId: input.runId, revision: "fixture-new", persisted: true, promoted: false, verified: false, diagnostics: [] }; } });
  const input = writeInput();
  const blockId = input.analysis.content.blocks[0].id;
  input.analysis.presentation.facts = [{ id: "revenue", label: "FY2026 revenue", value: 3.014, unit: "USD bn", status: "known", asOf: "FY2026", sourceBlockIds: [blockId], provenance: structuredClone(f.provenance) }];
  const response = await (await handler(core)(request("save_analysis", { ...base, input }))).json();
  const text = JSON.parse(response.result.content[0].text);
  assert.equal(text.result.error.code, "invalid_input");
  assert.equal(response.result.isError, true);
  assert.equal(writes, 0);
  input.analysis.presentation.facts[0].asOf = null;
  const corrected = await call(handler(core), "save_analysis", { ...base, input });
  assert.equal(corrected.result.status, "ok");
  assert.equal(corrected.result.data.status, "persisted");
  assert.equal(writes, 1);
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
      assert.equal((await client.listTools()).tools.length, 8);
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

test("catalog publishes only reachable output definitions and text mirrors completed results", async () => {
  const json = await (await handler()(request("", base, { body: { method: "tools/list", params: {} } }))).json();
  const bytes = value => Buffer.byteLength(JSON.stringify(value));
  for (const tool of json.result.tools) {
    const defs = tool.outputSchema.definitions ?? {};
    const refs = new Set(JSON.stringify(tool.outputSchema).match(/#\/definitions\/[A-Za-z0-9_.-]+/g)?.map(ref => ref.split("/").at(-1)) ?? []);
    assert.deepEqual(Object.keys(defs).sort(), [...refs].sort(), `${tool.name} publishes unreachable definitions`);
  }
  assert.ok(bytes(json.result.tools) < 400_000, `catalog ${bytes(json.result.tools)} bytes`);
  // MCP 2025-11-25: schemas default to JSON Schema 2020-12 unless $schema says otherwise;
  // ours are draft-07 (they use `definitions`), so every published schema declares it.
  for (const tool of json.result.tools) {
    assert.equal(tool.inputSchema.$schema, "http://json-schema.org/draft-07/schema#", `${tool.name} input dialect`);
    assert.equal(tool.outputSchema.$schema, "http://json-schema.org/draft-07/schema#", `${tool.name} output dialect`);
    assert.ok(typeof tool.title === "string" && tool.title.length > 0 && tool.title.length <= 64, `${tool.name} title`);
  }
  assert.equal(new Set(json.result.tools.map(tool => tool.title)).size, json.result.tools.length);
  const demo = api.createMcpHandler({ authenticate: () => caller, service: () => api.createDemoInvestmentService() });
  const response = await (await demo(request("get_portfolio", { ...base, scope: "demo" }))).json();
  assert.equal(response.result.structuredContent.status, "completed");
  assert.equal(response.result.structuredContent.result.status, "ok");
  // Text-only clients receive the same completed envelope, not only its status.
  assert.deepEqual(JSON.parse(response.result.content[0].text), response.result.structuredContent);
});

test("report form: validated by the published schema, built by the Core, refused with field-level diagnostics", async () => {
  let seen;
  const render = markdown => ({ schemaVersion: "1.0.0", blocks: markdown.split("\n\n").filter(Boolean).map((text, i) => ({ id: `r${i}`, sourceIds: ["r"], type: "paragraph", text: [{ text, marks: [], href: null }] })) });
  const core = api.createInvestmentCore({ renderReportContent: render, writeAnalysis: async intent => { seen = intent; return { schemaVersion: "1.0.0", status: "persisted", analysisId: "page-1", runId: intent.runId, revision: "r1", persisted: true, promoted: false, verified: false, diagnostics: [] }; } });
  const report = { format: "report", runId: "BC-X-1", kind: "business", companyId: "c1", title: "Business Check", date: "2026-10-06", status: "Draft", reportMarkdown: "Synthèse [E:s1].\n\nRisques.", summary: null, verdict: "Bonne", confidence: "Medium", score: 74 };
  const ok = await call(handler(core), "save_analysis", { ...base, input: report });
  assert.equal(ok.status, "completed"); assert.equal(ok.result.status, "ok");
  assert.equal(seen.analysis.kind, "business"); assert.deepEqual(seen.analysis.content.blocks[0].sourceIds, ["s1"]);
  const transportRejected = await call(handler(core), "save_analysis", { ...base, input: { ...report, kind: "decision" } });
  assert.equal(transportRejected.status, "rejected"); assert.equal(transportRejected.error.code, "invalid_input");
  const coreRejected = await call(handler(core), "save_analysis", { ...base, input: { ...report, score: 74.5 } });
  assert.equal(coreRejected.result.error.code, "invalid_input");
  assert.match(coreRejected.result.metadata.diagnostics[0].message, /score must be an integer/);
});

test("Sites campaign policy applies the same envelope to the report form", async () => {
  const { isAuthorizedSiteCampaignWrite, SITE_CAMPAIGN_EXPIRES_AT } = api;
  const before = Date.parse(SITE_CAMPAIGN_EXPIRES_AT) - 60_000;
  const runId = "FV-SU-20261006-LOT13-E2E", allowed = [runId];
  const report = { format: "report", runId, kind: "business", companyId: "3b337ea7-af35-81ca-97c4-f048f9d52b1c", title: "t", date: "2026-10-06", status: "Draft", reportMarkdown: "x", summary: null, verdict: null, confidence: null };
  assert.equal(isAuthorizedSiteCampaignWrite(report, allowed, before), true);
  assert.equal(isAuthorizedSiteCampaignWrite({ ...report, status: "Validated" }, allowed, before), false);
  assert.equal(isAuthorizedSiteCampaignWrite({ ...report, kind: "short" }, allowed, before), false);
  assert.equal(isAuthorizedSiteCampaignWrite({ ...report, companyId: "other" }, allowed, before), false);
  assert.equal(isAuthorizedSiteCampaignWrite(report, [], before), false);
  assert.equal(isAuthorizedSiteCampaignWrite({ ...report, runId: "constructor" }, ["constructor"], before), false, "no prototype lookup");
  assert.equal(isAuthorizedSiteCampaignWrite(report, allowed, Date.parse(SITE_CAMPAIGN_EXPIRES_AT)), false, "expired");
});

test("MCP tools spec: servers MUST rate limit tool invocations — READ budget per caller, isolated and windowed", async () => {
  let now = 1_000_000, calls = 0;
  const core = api.createInvestmentCore({ readCompany: async () => { calls++; return null; } });
  const h = api.createMcpHandler({ authenticate: request => ({ ...caller, subject: request.headers.get("x-test-subject") ?? caller.subject }), service: () => core, readRateLimit: { max: 3, windowMs: 60_000, now: () => now } });
  const as = (subject) => async () => output(await h(request("get_company", { ...base, id: "c1" }, { headers: { "x-test-subject": subject } })));
  for (let i = 0; i < 3; i++) assert.equal((await as("alice")()).status, "completed");
  const limited = await as("alice")();
  assert.equal(limited.status, "rejected"); assert.equal(limited.error.code, "rate_limit"); assert.equal(limited.error.outcome, "not_started");
  assert.equal((await as("bob")()).status, "completed", "budgets are per caller");
  assert.equal(calls, 4, "the limited call never reached the Core");
  now += 60_001;
  assert.equal((await as("alice")()).status, "completed", "window resets");
});

test("review fix: report form cannot bypass write approval, demo refusal or the campaign envelope", async () => {
  let calls = 0;
  const core = api.createInvestmentCore({ renderReportContent: () => ({ schemaVersion: "1.0.0", blocks: [] }), writeAnalysis: async () => { calls++; throw new Error("must not write"); } });
  const report = { format: "report", runId: "FV-SU-20261006-LOT13-E2E", kind: "business", companyId: "3b337ea7af3581ca97c4f048f9d52b1c", title: "t", date: "2026-10-06", status: "Draft", reportMarkdown: "x", summary: null, verdict: null, confidence: null };
  const cases = [
    [{ ...caller, writeApproved: false }, base, report, "confirmation_required"],
    [caller, { ...base, scope: "demo" }, report, "forbidden"],
    [{ ...caller, allowedWriteRunIds: [report.runId] }, base, { ...report, kind: "short" }, "forbidden"],
    [{ ...caller, allowedWriteRunIds: [report.runId] }, base, { ...report, status: "Validated" }, "forbidden"],
  ];
  for (const [identity, args, input, code] of cases) {
    const result = await call(handler(core, identity), "save_analysis", { ...args, input });
    assert.equal(result.status, "rejected"); assert.equal(result.error.code, code);
  }
  assert.equal(calls, 0);
});

test("review fix: the READ limiter memory is hard-capped", async () => {
  let now = 0;
  const core = api.createInvestmentCore({ readCompany: async () => null });
  const h = api.createMcpHandler({ authenticate: r => ({ ...caller, subject: r.headers.get("x-test-subject") }), service: () => core, readRateLimit: { max: 5, windowMs: 60_000, now: () => now, maxCallers: 3 } });
  for (const subject of ["a", "b", "c", "d"]) assert.equal((await output(await h(request("get_company", { ...base, id: "c" }, { headers: { "x-test-subject": subject } })))).status, "completed");
  const tracked = h.trackedReadCallers?.();
  assert.ok(tracked !== undefined && tracked <= 3, `tracked callers ${tracked}`);
});
