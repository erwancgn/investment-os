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

test("resolveCompany matches a ticker with or without its exchange suffix and says so when ambiguous", async () => {
  const { createInvestmentCore } = await api();
  const identities = [
    { companyId: "fr-su", canonicalName: "Schneider Electric", ticker: "SU.PA", exchange: "Euronext Paris", assetId: null, aliases: [] },
    { companyId: "uk-su", canonicalName: "Example Suffix Plc", ticker: "SU.L", exchange: "LSE", assetId: null, aliases: [] },
    { companyId: "us-ms", canonicalName: "Microsoft Corporation", ticker: "MSFT", exchange: "NASDAQ", assetId: null, aliases: [] },
  ];
  const core = createInvestmentCore({ readCompanyIdentities: async () => identities });
  assert.equal((await core.resolveCompany("SU.PA")).data.candidates[0].companyId, "fr-su", "full ticker");
  assert.equal((await core.resolveCompany("su.pa")).data.status, "resolved", "case-insensitive");
  assert.deepEqual((await core.resolveCompany("SU", "Euronext Paris")).data.candidates.map(c => c.companyId), ["fr-su"], "base ticker + exchange");
  assert.equal((await core.resolveCompany("SU")).data.status, "ambiguous", "base ticker across exchanges is ambiguous, never guessed");
  assert.equal((await core.resolveCompany("MS")).data.status, "not_found", "a prefix is not a ticker");
  assert.equal((await core.resolveCompany("MSFT")).data.status, "resolved", "unsuffixed tickers unchanged");
});

const lot9Identities = [
  { companyId: "fr-su", canonicalName: "Schneider Electric", ticker: "SU.PA", exchange: "Euronext Paris", assetId: null, aliases: [], isin: "FR0000121972" },
  { companyId: "us-mu", canonicalName: "Micron Technology", ticker: "MU", exchange: "NASDAQ", assetId: "mu", aliases: [], isin: "US5951121038" },
  { companyId: "us-googl", canonicalName: "Alphabet Inc.", ticker: "GOOGL", exchange: "NASDAQ", assetId: "googl", aliases: ["Google"], isin: "US02079K3059" },
  { companyId: "ca-su", canonicalName: "Suncor Energy", ticker: "SU", exchange: "NYSE", assetId: null, aliases: [] },
];

test("resolveCompany: real-world spellings of known companies never come back not_found (Lot 9 regressions)", async () => {
  const { createInvestmentCore } = await api();
  const core = createInvestmentCore({ readCompanyIdentities: async () => lot9Identities });
  const ids = async (query, market) => { const r = (await core.resolveCompany(query, market)).data; return { status: r.status, ids: r.candidates.map(c => c.companyId).sort() }; };
  // Lot 9 failures, now resolved.
  assert.deepEqual(await ids("Schneider (SU)"), { status: "resolved", ids: ["fr-su"] }, "name + ticker in parentheses");
  assert.deepEqual(await ids("Schneider Electric", "EPA"), { status: "resolved", ids: ["fr-su"] }, "exchange code alias");
  assert.deepEqual(await ids("SU", "Euronext Paris"), { status: "resolved", ids: ["fr-su"] }, "base ticker + exchange");
  assert.deepEqual(await ids("Schneider Electric SE"), { status: "resolved", ids: ["fr-su"] }, "legal form ignored");
  assert.deepEqual(await ids("FR0000121972"), { status: "resolved", ids: ["fr-su"] }, "ISIN");
  assert.deepEqual(await ids("fr 0000 121972"), { status: "resolved", ids: ["fr-su"] }, "ISIN with spaces, lower case");
  assert.deepEqual(await ids("Micron"), { status: "ambiguous", ids: ["us-mu"] }, "partial name is a candidate to confirm, never not_found");
  assert.deepEqual(await ids("Micron Technology Inc"), { status: "resolved", ids: ["us-mu"] });
  assert.deepEqual(await ids("MU", "NASDAQ"), { status: "resolved", ids: ["us-mu"] });
  assert.deepEqual(await ids("MU", "XNAS"), { status: "resolved", ids: ["us-mu"] }, "MIC code alias");
  assert.deepEqual(await ids("Alphabet (GOOGL)"), { status: "resolved", ids: ["us-googl"] });
  assert.deepEqual(await ids("Google"), { status: "resolved", ids: ["us-googl"] }, "alias");
  // Market filter never hides an existing company.
  assert.deepEqual(await ids("Micron Technology", "NYSE"), { status: "ambiguous", ids: ["us-mu"] }, "wrong market: candidate kept for confirmation");
  // Ambiguity is never guessed.
  assert.deepEqual(await ids("SU"), { status: "ambiguous", ids: ["ca-su", "fr-su"] });
  assert.deepEqual(await ids("Schneider"), { status: "ambiguous", ids: ["fr-su"] });
  // Genuinely unknown stays not_found; short noise does not match everything.
  assert.deepEqual(await ids("Hermès International"), { status: "not_found", ids: [] });
  assert.deepEqual(await ids("SA"), { status: "not_found", ids: [] });
  // Candidates expose the ISIN so a model can confirm identity.
  assert.equal((await core.resolveCompany("FR0000121972")).data.candidates[0].isin, "FR0000121972");
  assert.equal((await core.resolveCompany("Suncor Energy")).data.candidates[0].isin, null);
});

test("createCompany: ISIN required and checked, duplicates refused from the cache before any write", async () => {
  const { createInvestmentCore } = await api();
  const created = [];
  const core = createInvestmentCore({ readCompanyIdentities: async () => lot9Identities, createCompany: async input => { created.push(input); return { status: "created", candidates: [{ companyId: "new-id", canonicalName: input.name, ticker: input.ticker, exchange: input.exchange, assetId: null, isin: input.isin }] }; } });
  const valid = { name: "Hermès International", ticker: "rms.pa", exchange: "Euronext Paris", isin: "FR0000052292", currency: "EUR", country: "France" };
  // Field validation never reaches the port.
  for (const bad of [{ ...valid, isin: null }, { ...valid, isin: "FR0000052293" }, { ...valid, name: " " }, { ...valid, ticker: "R M S" }, { ...valid, currency: "euro" }, { ...valid, extra: 1 }]) {
    const r = await core.createCompany(bad);
    assert.equal(r.status, "error", JSON.stringify(bad)); assert.equal(r.error.code, "invalid_input");
  }
  // Every duplicate key short-circuits to "existing": ISIN, full or base ticker, name with or without legal form.
  for (const duplicate of [
    { ...valid, name: "Schneider Electric SE", ticker: "SU.PA", isin: "FR0000121972" },
    { ...valid, name: "Totally Different Name", isin: "FR0000121972" },
    { ...valid, name: "Micron Technology Inc", ticker: "MU", isin: "US5951121038" },
    { ...valid, name: "Micron", ticker: "MU", isin: "US5951121038" },
    { ...valid, name: "New Name", ticker: "GOOGL", isin: "US38259P5089" },
  ]) {
    const r = await core.createCompany(duplicate);
    assert.equal(r.status, "ok", JSON.stringify(duplicate)); assert.equal(r.data.status, "existing", JSON.stringify(duplicate));
    assert.ok(r.data.candidates.length >= 1);
  }
  assert.equal(created.length, 0, "no duplicate reached the writer");
  const r = await core.createCompany(valid);
  assert.equal(r.data.status, "created");
  assert.deepEqual(created, [{ name: "Hermès International", ticker: "RMS.PA", exchange: "Euronext Paris", isin: "FR0000052292", currency: "EUR", country: "France" }], "normalized input");
  assert.equal((await createInvestmentCore({ readCompanyIdentities: async () => [] }).createCompany(valid)).error.code, "dependency");
});
