import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import * as fixtures from "./fixtures/investment-contracts.mjs";

let coreModule;
async function api() {
  if (!coreModule) {
    const entryPoint = fileURLToPath(new URL("../core/services/investment-os.ts", import.meta.url));
    const result = await build({ entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm" });
    coreModule = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  }
  return coreModule;
}

function analysis(overrides = {}) {
  const header = { ...fixtures.analysisHeader(), ...overrides.header };
  return {
    schemaVersion: "1.0.0", kind: header.family, header,
    content: { schemaVersion: "1.0.0", blocks: [] }, summary: "Validated summary", verdict: "Conserver", confidence: "High",
    presentation: { facts: [], scenarios: [], thresholds: [] }, projection: { status: "absent" }, diagnostics: [], score: "82/100",
    ...overrides,
  };
}

test("service Core imports only domain modules and no source, UI or transport runtime", async () => {
  const entryPoint = fileURLToPath(new URL("../core/services/investment-os.ts", import.meta.url));
  const result = await build({ entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm", metafile: true });
  assert.ok(Object.keys(result.metafile.inputs).every(path => !path.split(/[\\/]/).some(part => ["app", "worker", "adapters", "node_modules"].includes(part))));
});
const candidate = (id, extra = {}) => ({
  id, family: "business", sourceKind: "analysis", agent: "Business Analyst", status: "Validated",
  date: "2026-09-01", lastEditedTime: "2026-09-01T10:00:00.000Z", companyIds: ["company-1"],
  sourceFreshness: "fresh", archived: false, ...extra,
});

test("core validates canonical reader results, preserves options, and classifies missing ports", async () => {
  const { createInvestmentCore } = await api();
  let gotOptions;
  const core = createInvestmentCore({
    readCompany: async id => id === "company-1" ? fixtures.companyPreview() : null,
    readPortfolio: async options => { gotOptions = options; return fixtures.portfolio(); },
    readPosition: async (id, options) => { gotOptions = options; return id === "position-1" ? fixtures.position() : null; },
    readQuote: async assetId => ({ ...fixtures.quote(), assetId }),
  });
  assert.equal((await core.getCompany("company-1")).status, "ok");
  assert.equal((await core.getCompany("missing")).data, null);
  assert.equal((await core.getCompany(" ")).error.code, "invalid_input");
  assert.equal((await core.getPortfolio({ force: true, cacheOnly: false })).status, "ok");
  assert.deepEqual(gotOptions, { force: true, cacheOnly: false });
  assert.equal((await core.getPosition("position-1", { cacheOnly: true })).status, "ok");
  assert.equal((await core.getPosition("position-1")).data.lifecycle, "open");
  assert.equal((await core.getQuote("asset-1")).data.assetId, "asset-1");
  assert.equal((await core.getAnalysisById("analysis-1")).error.code, "dependency");
  assert.equal((await core.saveAnalysis({})).error.code, "invalid_input");
});

test("company resolution respects exact ticker, name, aliases, market ambiguity and absence", async () => {
  const { createInvestmentCore } = await api();
  const identities = [
    { companyId: "us-1", canonicalName: "Microsoft Corporation", ticker: "MSFT", exchange: "NASDAQ", assetId: "msft", aliases: ["Microsoft"] },
    { companyId: "jp-1", canonicalName: "Example Japan", ticker: "LITE", exchange: "TSE", assetId: null, aliases: [] },
    { companyId: "us-2", canonicalName: "Lumentum Holdings", ticker: "LITE", exchange: "NASDAQ", assetId: "lite", aliases: ["Lumentum"] },
  ];
  const core = createInvestmentCore({ readCompanyIdentities: async () => identities });
  assert.equal((await core.resolveCompany("MSFT")).data.candidates[0].companyId, "us-1");
  assert.equal((await core.resolveCompany("Microsoft Corporation")).data.status, "resolved");
  assert.equal((await core.resolveCompany("Microsoft")).data.status, "resolved");
  assert.deepEqual((await core.resolveCompany("LITE")).data.candidates.map(item => item.companyId), ["jp-1", "us-2"]);
  assert.equal((await core.resolveCompany("LITE")).data.status, "ambiguous");
  assert.equal((await core.resolveCompany("LITE", "NASDAQ")).data.candidates[0].companyId, "us-2");
  assert.deepEqual((await core.resolveCompany("absent")).data, { status: "not_found", candidates: [] });
  assert.equal((await core.resolveCompany(" ")).error.code, "invalid_input");
  assert.equal((await createInvestmentCore({}).resolveCompany("MSFT")).error.code, "dependency");
});

test("analysis by ID enforces identity and canonical validation", async () => {
  const { createInvestmentCore } = await api();
  const valid = analysis();
  const core = createInvestmentCore({ readAnalysis: async id => id === "analysis-1" ? valid : { ...valid, header: { ...valid.header, id } , score: 4 } });
  assert.equal((await core.getAnalysisById("analysis-1")).status, "ok");
  assert.equal((await core.getAnalysisById("analysis-2")).error.code, "mapping");
  assert.equal((await core.getAnalysisById(" ")).error.code, "invalid_input");
  const wrongCompany = createInvestmentCore({ readCompany: async () => fixtures.companyPreview() });
  assert.equal((await wrongCompany.getCompany("other-company")).error.code, "mapping");
});

test("Current selection rejects broken explicit pointers and validates hydrated document context", async () => {
  const { createInvestmentCore } = await api();
  const doc = analysis();
  const input = { companyId: "company-1", family: "business", explicitCurrentIds: ["analysis-1"], candidates: [candidate("analysis-1")] };
  const core = createInvestmentCore({ readCurrentContext: async () => input, readAnalysis: async () => doc });
  const selected = await core.getCurrentAnalysis("company-1", "business");
  assert.equal(selected.status, "ok");
  assert.equal(selected.data.header.id, "analysis-1");
  assert.ok(selected.metadata.diagnostics.some(item => item.code === "unmapped_current_status") === false);

  const invalid = createInvestmentCore({ readCurrentContext: async () => ({ ...input, explicitCurrentIds: ["missing"] }), readAnalysis: async () => doc });
  assert.equal((await invalid.getCurrentAnalysis("company-1", "business")).error.code, "mapping");
  const archived = createInvestmentCore({ readCurrentContext: async () => ({ ...input, candidates: [candidate("analysis-1", { archived: true })] }), readAnalysis: async () => doc });
  assert.equal((await archived.getCurrentAnalysis("company-1", "business")).error.code, "mapping");
  const wrongOwner = createInvestmentCore({ readCurrentContext: async () => ({ ...input, candidates: [candidate("analysis-1", { companyIds: ["elsewhere"] })] }), readAnalysis: async () => doc });
  assert.equal((await wrongOwner.getCurrentAnalysis("company-1", "business")).error.code, "mapping");
  const mismatchedBody = createInvestmentCore({ readCurrentContext: async () => input, readAnalysis: async () => ({ ...doc, header: { ...doc.header, companyIds: ["elsewhere"] } }) });
  assert.equal((await mismatchedBody.getCurrentAnalysis("company-1", "business")).error.code, "mapping");
  const noPort = createInvestmentCore({});
  assert.equal((await noPort.getCurrentAnalysis("company-1", "business")).error.code, "dependency");
});

test("list results and read failures are validated and sanitized", async () => {
  const { createInvestmentCore } = await api();
  const validPreview = fixtures.companyPreview().analyses[0];
  const core = createInvestmentCore({ listAnalyses: async params => { assert.deepEqual(params, { family: "business" }); return [validPreview]; }, readQuote: async () => { throw Object.assign(new Error("private SQL details"), { code: "timeout" }); } });
  assert.equal((await core.listAnalyses({ family: "business" })).status, "ok");
  const badList = createInvestmentCore({ listAnalyses: async () => [{ ...validPreview, raw: "body" }] });
  assert.equal((await badList.listAnalyses()).error.code, "mapping");
  const failed = await core.getQuote("asset-1");
  assert.equal(failed.error.code, "timeout");
  assert.equal(failed.error.message.includes("SQL"), false);
  const aborted = createInvestmentCore({ readAnalysis: async () => { throw Object.assign(new Error("private DB abort"), { name: "AbortError" }); } });
  assert.equal((await aborted.getAnalysisById("analysis-1")).error.code, "timeout");
});

test("save validates run identity, revision and company references and only reports adapter receipts", async () => {
  const { createInvestmentCore } = await api();
  const doc = analysis();
  const input = { analysis: doc, runId: "run-42", expectedRevision: "rev-7", companyIds: ["company-1"] };
  let writes = 0;
  const receipt = { schemaVersion: "1.0.0", status: "persisted", analysisId: "analysis-1", runId: "run-42", revision: "rev-8", persisted: true, promoted: false, verified: false, diagnostics: [] };
  const core = createInvestmentCore({ writeAnalysis: async value => { writes++; assert.equal(value.runId, "run-42"); return receipt; } });
  assert.equal((await core.saveAnalysis(input)).data.status, "persisted");
  assert.equal((await core.saveAnalysis(input)).data.status, "persisted", "same run ID is forwarded for adapter-level replay handling");
  assert.equal((await core.saveAnalysis({ ...input, companyIds: ["other"] })).error.code, "invalid_input");
  assert.equal(writes, 2);

  const missing = await createInvestmentCore({}).saveAnalysis(input);
  assert.equal(missing.error.code, "dependency");
  const impossibleReceipt = await createInvestmentCore({ writeAnalysis: async () => ({ ...receipt, status: "verified", promoted: false, verified: true }) }).saveAnalysis(input);
  assert.equal(impossibleReceipt.error.code, "mapping");
  const partial = { ...receipt, status: "partial", persisted: true, promoted: false, verified: false, diagnostics: [{ code: "promotion_pending", message: "Promotion not performed", severity: "warning" }] };
  assert.equal((await createInvestmentCore({ writeAnalysis: async () => partial }).saveAnalysis(input)).data.status, "partial");
});

test("closed positions can be addressed separately and do not enter portfolio holdings", async () => {
  const { createInvestmentCore } = await api();
  const closed = { ...fixtures.position("closed"), id: "closed-1" };
  const portfolio = fixtures.portfolio();
  const core = createInvestmentCore({ readPosition: async id => id === "closed-1" ? closed : null, readPortfolio: async () => portfolio });
  assert.equal((await core.getPosition("closed-1")).data.lifecycle, "closed");
  assert.equal((await core.getPortfolio()).data.positions.some(position => position.lifecycle === "closed"), false);
});
