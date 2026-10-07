import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import Ajv from "ajv";
import { generateMcpSchemas } from "../scripts/generate-mcp-schemas.mjs";
import * as fixtures from "./fixtures/investment-contracts.mjs";

const bundle = JSON.parse(readFileSync(new URL("../contracts/mcp.v1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv({ allErrors: true }); // Existing installed dependency; draft-07.
const validators = Object.fromEntries(Object.entries(bundle.tools).map(([name, schemas]) => [name,
  Object.fromEntries(Object.entries(schemas).map(([kind, schema]) => [kind, ajv.compile({ ...schema, definitions: bundle.definitions })]))
]));
const base = { contractVersion: "1.0.0", scope: "personal" };
const doc = { schemaVersion: "1.0.0", kind: "business", header: fixtures.analysisHeader(), content: { schemaVersion: "1.0.0", blocks: [] }, summary: null, verdict: null, confidence: null, presentation: { facts: [], scenarios: [], thresholds: [] }, projection: { status: "absent" }, diagnostics: [], score: null };
const save = { analysis: doc, runId: "run-42", expectedRevision: null, companyIds: ["company-1"] };
const inputs = {
  resolve_company: { ...base, query: "Microsoft", market: "NASDAQ" },
  get_company: { ...base, id: "company-1" }, get_portfolio: { ...base, options: { force: true, cacheOnly: false } },
  get_position: { ...base, id: "position-1", options: { cacheOnly: true } },
  get_current_analysis: { ...base, companyId: "company-1", family: "business" },
  get_analysis_by_id: { ...base, id: "analysis-1" }, save_analysis: { ...base, input: save },
  get_quote: { ...base, assetId: "asset-1", options: { force: false } },
};
async function load(path, metafile = false) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", metafile });
  return { api: await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`), result };
}
const { api: contract, result: contractBuild } = await load("../contracts/mcp.ts", true);
const { api: core } = await load("../core/services/investment-os.ts");
const completed = result => ({ ...base, status: "completed", result });
function matches(tool, kind, value) {
  const validate = validators[tool][kind];
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

test("checked-in schemas are deterministic and derived from current Core types", () => {
  assert.deepEqual(bundle, generateMcpSchemas());
  assert.equal(bundle.contractVersion, contract.MCP_CONTRACT_VERSION);
  assert.deepEqual(Object.keys(bundle.tools), Object.keys(contract.MCP_TOOLS));
  assert.equal("list_analyses" in bundle.tools, false);
});

test("contract has no executable domain, server or runtime imports", () => {
  assert.deepEqual(Object.keys(contractBuild.metafile.inputs), ["contracts/mcp.ts"]);
  assert.deepEqual(Object.entries(contract.MCP_TOOLS).filter(([, t]) => t.access === "WRITE").map(([name]) => name).sort(), ["create_company", "save_analysis"]);
  assert.equal(contract.MCP_TOOLS.save_analysis.access, "WRITE");
  assert.deepEqual(contract.MCP_LIMITS, { requestBytes: 2097152, responseBytes: 4194304, readTimeoutMs: 30000, writeTimeoutMs: 30000, readAttempts: 2, writeAttempts: 1, readsPerWindow: 120, readWindowMs: 60000, writesPerWindow: 100, writeWindowMs: 86400000 });
});

test("all inputs accept explicit personal/demo scopes and reject spoofed caller, secrets and versions", () => {
  for (const [tool, input] of Object.entries(inputs)) {
    matches(tool, "inputSchema", input);
    matches(tool, "inputSchema", { ...input, scope: "demo" }); // Authorization is separate from shape.
    for (const bad of [{ ...input, contractVersion: "2.0.0" }, { ...input, scope: "public" }, { ...input, callerId: "owner" }, { ...input, token: "fixture-not-a-secret" }, { ...input, confirmed: true }]) {
      assert.equal(validators[tool].inputSchema(bad), false, tool);
    }
    const missingVersion = { ...input }; delete missingVersion.contractVersion;
    assert.equal(validators[tool].inputSchema(missingVersion), false);
  }
});

test("input schemas reject malformed options, ids, families and incomplete write intent", () => {
  for (const query of ["", " x", "x ", "x".repeat(513), 42]) assert.equal(validators.resolve_company.inputSchema({ ...inputs.resolve_company, query }), false);
  for (const id of ["", " x", "x ", "x".repeat(513), 42]) assert.equal(validators.get_company.inputSchema({ ...inputs.get_company, id }), false);
  matches("get_company", "inputSchema", { ...inputs.get_company, id: "x".repeat(512) });
  for (const options of [{ force: "true" }, { cursor: "x" }, null]) assert.equal(validators.get_portfolio.inputSchema({ ...base, options }), false);
  assert.equal(validators.get_current_analysis.inputSchema({ ...inputs.get_current_analysis, family: "unknown" }), false);
  for (const key of ["runId", "expectedRevision", "companyIds", "analysis"]) {
    const input = { ...save }; delete input[key];
    assert.equal(validators.save_analysis.inputSchema({ ...base, input }), false, key);
  }
  assert.equal(validators.save_analysis.inputSchema({ ...base, input: { ...save, analysis: { ...doc, rawSource: "forbidden" } } }), false);
});

test("each exact manifest mapping reaches the existing Core method with untouched arguments", async () => {
  const calls = [];
  const ports = {
    readCompanyIdentities: async () => { calls.push(["resolveCompany"]); return [{ companyId: "company-1", canonicalName: "Microsoft", ticker: "MSFT", exchange: "NASDAQ", assetId: null, aliases: [] }]; },
    readCompany: async id => { calls.push(["getCompany", id]); return fixtures.companyPreview(); },
    readPortfolio: async options => { calls.push(["getPortfolio", options]); return fixtures.portfolio(); },
    readPosition: async (id, options) => { calls.push(["getPosition", id, options]); return fixtures.position(); },
    readCurrentContext: async (companyId, family) => { calls.push(["getCurrentAnalysis", companyId, family]); return { companyId, family, candidates: [], explicitCurrentIds: [] }; },
    readAnalysis: async id => { calls.push(["getAnalysisById", id]); return doc; },
    writeAnalysis: async input => { calls.push(["saveAnalysis", input]); return { schemaVersion: "1.0.0", status: "persisted", analysisId: "assigned-id", runId: input.runId, revision: "r1", persisted: true, promoted: false, verified: false, diagnostics: [] }; },
    readQuote: async (id, options) => { calls.push(["getQuote", id, options]); return fixtures.quote(); },
  };
  const service = core.createInvestmentCore(ports);
  for (const [tool, input] of Object.entries(inputs)) {
    const spec = contract.MCP_TOOLS[tool];
    const args = spec.arguments.map(key => input[key]);
    const result = await service[spec.operation](...args); // Test harness only; no transport dispatcher.
    assert.equal(result.status, "ok", tool);
    matches(tool, "outputSchema", completed(result));
    assert.deepEqual(calls.at(-1), tool === "resolve_company" ? ["resolveCompany"] : [spec.operation, ...args]);
    if (tool === "save_analysis") assert.equal(calls.at(-1)[1], save);
  }
});

test("writer receipts remain observable and Core alone rejects contradictory receipts", async () => {
  for (const [status, persisted, promoted, verified] of [["persisted", true, false, false], ["promotion_pending", true, false, false], ["verified", true, true, true], ["partial", false, false, false], ["partial", true, true, false]]) {
    const receipt = { schemaVersion: "1.0.0", status, analysisId: "assigned-id", runId: save.runId, revision: null, persisted, promoted, verified, diagnostics: [{ code: "receipt_state", message: "Safe fixture", severity: "warning" }] };
    let attempts = 0;
    const service = core.createInvestmentCore({ writeAnalysis: async () => { attempts++; return receipt; } });
    const result = await service.saveAnalysis(save);
    matches("save_analysis", "outputSchema", completed(result));
    assert.equal(result.data, receipt);
    assert.equal(attempts, 1);
    const invalid = await core.createInvestmentCore({ writeAnalysis: async () => ({ ...receipt, status: "verified", verified: false }) }).saveAnalysis(save);
    assert.equal(invalid.error.code, "mapping");
    matches("save_analysis", "outputSchema", completed(invalid));
  }
});

test("null absence, archived document, closed position and stale/unavailable data retain Core semantics", async () => {
  const service = core.createInvestmentCore({ readCompany: async () => null, readPosition: async () => fixtures.position("closed"), readAnalysis: async () => ({ ...doc, header: { ...doc.header, archived: true, sourceFreshness: "stale" } }), readQuote: async () => ({ ...fixtures.quote(), freshness: "unavailable", nativePrice: null, eurPrice: null, fxRate: null }) });
  for (const [tool, operation, id] of [["get_company", "getCompany", "missing"], ["get_position", "getPosition", "position-1"], ["get_analysis_by_id", "getAnalysisById", "analysis-1"], ["get_quote", "getQuote", "asset-1"]]) {
    const result = await service[operation](id);
    assert.equal(result.status, "ok");
    matches(tool, "outputSchema", completed(result));
    if (tool === "get_analysis_by_id") assert.equal(result.metadata.freshness, "stale");
  }
});

test("every Core error code and safe diagnostics is accepted without raw error fields", async () => {
  const codes = ["invalid_input", "unsupported_version", "not_found", "unauthorized", "forbidden", "mapping", "normalization", "storage", "dependency", "rate_limit", "timeout", "network", "cache", "stale_request"];
  for (const code of codes) {
    const result = await core.createInvestmentCore({ readQuote: async () => { throw { code }; } }).getQuote("asset-1");
    for (const tool of Object.keys(inputs)) matches(tool, "outputSchema", completed(result));
    assert.equal(validators.get_quote.outputSchema(completed({ ...result, error: { ...result.error, stack: "private" } })), false);
  }
});

test("transport errors distinguish not-started rejection and unknown write outcome", () => {
  for (const code of ["invalid_input", "unsupported_version", "unauthorized", "forbidden", "confirmation_required", "limit_exceeded", "timeout", "network", "rate_limit"]) {
    const value = { contractVersion: "1.0.0", scope: null, status: "rejected", error: { code, message: "Safe rejection", retryable: false, outcome: "not_started" }, diagnostics: [] };
    for (const tool of Object.keys(inputs)) matches(tool, "outputSchema", value);
    matches("save_analysis", "outputSchema", { ...value, scope: "personal", error: { ...value.error, outcome: "unknown" } });
    assert.equal(validators.save_analysis.outputSchema({ ...value, error: { ...value.error, outcome: "rolled_back" } }), false);
  }
});
