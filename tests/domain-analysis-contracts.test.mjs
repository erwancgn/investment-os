import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const NOW = Date.parse("2026-09-30T12:00:00.000Z");
let contracts;

async function api() {
  if (contracts) return contracts;
  const entry = fileURLToPath(new URL("../core/contracts/analysis.ts", import.meta.url));
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "esm" });
  contracts = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  return contracts;
}

const provenance = () => ({ kind: "notion", sourceId: "page-1", revision: "rev-1", capturedAt: "2026-09-30T10:00:00Z" });
const header = (family = "business", overrides = {}) => ({
  schemaVersion: "1.0.0", id: "analysis-1", title: "Business review", sourceUrl: "https://www.notion.so/analysis-1", family, originalFamily: null,
  sourceKind: family === "decision" ? "decision" : "analysis", agent: "Business Analyst", status: "Validated",
  date: "2026-09-29", lastEditedTime: "2026-09-30T10:00:00Z", companyIds: ["company-1", "company-2"],
  revision: "rev-1", sourceFreshness: "fresh", archived: false, provenance: provenance(), ...overrides,
});
const content = (blocks = []) => ({ schemaVersion: "1.0.0", blocks });
const base = (kind, extra = {}) => ({
  schemaVersion: "1.0.0", kind, header: header(kind), content: content(), summary: "Reviewed source summary",
  verdict: "Conserver", confidence: "High", presentation: { facts: [], scenarios: [], thresholds: [] },
  projection: { status: "absent" }, diagnostics: [], ...extra,
});
const emptyDecision = () => Object.fromEntries([
  "schemaVersion", "action", "outcome", "account", "instrumentType", "currentWeight", "maximumWeight", "maximumEntryPrice",
  "nextReview", "confidence", "coreThesis", "entryCondition", "executionPlan", "fundingSource", "catalyst",
  "invalidationCriteria", "keyRisk", "reviewTrigger",
].map(key => [key, key === "schemaVersion" ? "1.0.0" : null]));
const minimalProjection = () => ({
  presentationContractVersion: "1.0.0", analysisType: "business",
  identity: { company: "Example Corp", ticker: "EXM", exchange: null, currency: "USD", evidenceIds: ["ev-1"] },
  generatedAt: "2026-09-30T10:00:00Z", reportSha256: "a".repeat(64), summary: { text: "Summary", evidenceIds: ["ev-1"] },
  facts: [], scenarios: [], thresholds: [],
  sources: [{ id: "src-1", title: "Source", url: "https://example.com", publishedAt: null, retrievedAt: "2026-09-30T10:00:00Z", asOf: "2026-09-29T00:00:00Z", dataCategory: "other", freshness: "known", provenance: "collected_this_run" }],
  evidence: [{ id: "ev-1", sourceId: "src-1", claim: "Claim", locator: "Page 1", supportingData: "Summary", supportingDataSha256: "b".repeat(64), captureMethod: "source_retrieval", capturedAt: "2026-09-30T10:00:00Z", asOf: "2026-09-29T00:00:00Z", freshness: "known", freshnessCheckId: "fresh-1" }],
  freshnessChecks: [{ id: "fresh-1", dataCategory: "other", method: "latest_source_search", result: "latest_verified", checkedAt: "2026-09-30T10:00:00Z", checkedSourceIds: ["src-1"], supportingData: "Checked", supportingDataSha256: "c".repeat(64), captureMethod: "source_retrieval", capturedAt: "2026-09-30T10:00:00Z", locator: "Search" }],
  provenance: { runId: "run-1", pluginVersion: "1.2.6", contractVersion: "1.2.6" },
});

test("domain version and common dates, numbers, and safe-link policy are strict", async () => {
  const { SCHEMA_VERSION, isFiniteNumber, isIsoDate, isIsoDateTime, isIsoDateOrDateTime, isSafeHttpUrl } = await importCommon();
  assert.equal(SCHEMA_VERSION, "1.0.0");
  assert.equal(isFiniteNumber(0), true);
  assert.equal(isFiniteNumber(Number.NaN), false);
  assert.equal(isFiniteNumber(Number.POSITIVE_INFINITY), false);
  assert.equal(isIsoDate("2026-09-30", NOW), true);
  assert.equal(isIsoDate("2026-02-30", NOW), false);
  assert.equal(isIsoDate("2026-10-01", NOW), false);
  assert.equal(isIsoDate("2026-09-30", Number.NaN), false);
  assert.equal(isIsoDateTime("2026-09-30T12:00:00Z", NOW), true);
  assert.equal(isIsoDateTime("2026-09-30T24:00:00Z", NOW), false);
  assert.equal(isIsoDateTime("2026-09-30T12:60:00Z", NOW), false);
  assert.equal(isIsoDateTime("2026-09-30T12:00:00+14:01", NOW), false);
  assert.equal(isIsoDateTime("2026-09-30T12:00:00", NOW), false);
  assert.equal(isIsoDateOrDateTime("2026-09-29", NOW), true);
  assert.equal(isIsoDateOrDateTime("2026-09-30T10:00:00Z", NOW), true);
  assert.equal(isSafeHttpUrl("https://www.notion.so/page"), true);
  assert.equal(isSafeHttpUrl("http://example.com/path"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,hello"), false);
  assert.equal(isSafeHttpUrl("//example.com/path"), false);
  assert.equal(isSafeHttpUrl("https://user:secret@example.com"), false);
});

async function importCommon() {
  const entry = fileURLToPath(new URL("../core/contracts/common.ts", import.meta.url));
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "esm" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("AnalysisHeader and portable content preserve stable IDs and unsupported blocks", async () => {
  const { isAnalysisHeader, isAnalysisContent } = await api();
  const segment = (text, marks = [], href = null) => ({ text, marks, href });
  const blockSet = [
    { id: "heading-1", type: "heading", sourceIds: ["block-heading"], level: 2, text: [segment("Risks", ["bold", "italic"])] },
    { id: "list-1", type: "list", sourceIds: ["todo-1", "todo-2"], ordered: false, items: [[segment("Review concentration")], [segment("Source", [], "https://example.com/source")]] },
    { id: "table-1", type: "table", sourceIds: ["table-1"], header: true, rows: [[[segment("Metric")], [segment("Value")]], [[segment("Revenue")], [segment("123 USD", ["code"]), segment(" ")]]] },
    { id: "unsupported-1", type: "unsupported", sourceIds: ["todo-block"], sourceType: "to_do", text: "Important action not parsed", diagnostic: { code: "unsupported_block", message: "to_do is preserved as text", severity: "warning" } },
    { id: "paragraph-1", type: "paragraph", sourceIds: ["p-1"], text: [segment("123", ["bold"]), segment(" "), segment("456", ["italic"])] },
  ];
  assert.equal(isAnalysisHeader(header("business"), NOW), true);
  assert.equal(isAnalysisContent(content(blockSet), NOW), true);
  assert.equal(isAnalysisHeader(header("business", { current: true }), NOW), false);
  assert.equal(isAnalysisHeader(header("business", { sourceUrl: "javascript:alert(1)" }), NOW), false);
  assert.equal(isAnalysisHeader(header("unknown", { originalFamily: "custom-research" }), NOW), true);
  assert.equal(isAnalysisHeader(header("unknown"), NOW), false);
  assert.equal(isAnalysisHeader(header("business", { date: "2026-02-30" }), NOW), false);
  assert.equal(isAnalysisHeader(header("business", { lastEditedTime: "2026-09-30T10:00:00Z", revision: "" }), NOW), false);
  assert.equal(isAnalysisHeader(header("business", { schemaVersion: "2.0.0" }), NOW), false);
  assert.equal(isAnalysisHeader(header("business", { extra: "reject" }), NOW), false);
  assert.equal(isAnalysisContent(content([...blockSet, { ...blockSet[0], id: "heading-duplicate" }])), true, "one source block may project into multiple canonical blocks");
  assert.equal(isAnalysisContent(content([...blockSet, { ...blockSet[0], id: "heading-1" }])), false, "canonical block IDs must be unique");
  const unsafe = content([{ id: "unsafe", type: "paragraph", sourceIds: ["unsafe-link"], text: [segment("Click", [], "javascript:alert(1)")] }]);
  assert.equal(isAnalysisContent(unsafe), false);
  assert.equal(isAnalysisContent({ schemaVersion: "1.0.0", blocks: [{ id: "p", type: "paragraph", sourceIds: ["p"], text: [segment("ok"), { ...segment("oops"), extra: true }] }] }), false);
});

test("discriminated analysis families validate current fields and keep CIO free of scores", async () => {
  const { isAnalysis, isDecision } = await api();
  const business = base("business", { score: "82/100" });
  const valuation = { ...base("valuation"), header: header("valuation"), score: "75" };
  const short = base("short");
  const portfolio = { ...base("portfolio"), header: header("portfolio") };
  const memo = { ...base("cio_memo"), header: header("cio_memo"), handoffSummary: "Valuation validated; Short pending." };
  const decision = { ...base("decision"), header: header("decision"), decision: emptyDecision() };
  const earnings = {
    ...base("earnings"), header: header("earnings"), earningsReview: {
      fiscalPeriod: "Q2 2026", guidance: null, guidanceVsConsensus: "Above consensus", confidence: "Medium",
      refreshes: [{ key: "valuation", label: "Valuation", status: "recommended", rawValue: "Refresh" }],
    },
  };
  const generic = { ...base("unknown"), header: header("unknown", { originalFamily: "other-agent-template" }) };
  for (const analysis of [business, valuation, short, portfolio, memo, decision, earnings, generic]) assert.equal(isAnalysis(analysis, NOW), true, analysis.kind);
  assert.equal(isAnalysis({ ...memo, score: "99" }, NOW), false, "MemoAnalysis has no financial score field");
  assert.equal(isAnalysis({ ...business, header: header("valuation") }, NOW), false, "discriminator and header family must agree");
  assert.equal(isAnalysis({ ...decision, header: header("decision", { sourceKind: "analysis" }) }, NOW), false);
  assert.equal(isAnalysis({ ...earnings, earningsReview: { ...earnings.earningsReview, refreshes: [{ ...earnings.earningsReview.refreshes[0], status: "soon" }] } }, NOW), false);
  assert.equal(isAnalysis({ ...business, schemaVersion: "9.0.0" }, NOW), false);
  assert.equal(isDecision(emptyDecision()), true);
  assert.equal(isDecision({ ...emptyDecision(), schemaVersion: "2.0.0" }), false);
  assert.equal(isDecision({ ...emptyDecision(), unexpected: null }), false);
});

test("portable facts and scenarios retain provenance and only reference canonical block IDs", async () => {
  const { isAnalysis } = await api();
  const sourceBlock = { id: "fact-source", type: "paragraph", sourceIds: ["notion-block-1"], text: [{ text: "Revenue grew", marks: [], href: null }] };
  const p = provenance();
  const analysis = base("valuation", {
    header: header("valuation"), content: content([sourceBlock]), score: null,
    presentation: {
      facts: [{ id: "revenue", label: "Revenue", value: 12, unit: "USD bn", status: "known", asOf: "2026-09-29", sourceBlockIds: ["fact-source"], provenance: p }],
      scenarios: [{ id: "base", label: "Base", condition: "Demand holds", impact: "Fair value", status: "known", asOf: "2026-09-29T10:00:00Z", sourceBlockIds: ["fact-source"], provenance: p,
        terminalValue: null, cagrPercent: { id: "cagr", label: "CAGR", value: -3, unit: "%", status: "known", asOf: "2026-09-29", sourceBlockIds: ["fact-source"], provenance: p }, horizon: null }],
      thresholds: [{ id: "drawdown", label: "Drawdown limit", value: null, unit: "%", status: "unknown", asOf: null, sourceBlockIds: [], provenance: p }],
    },
  });
  assert.equal(isAnalysis(analysis, NOW), true);
  const orphanKnownFact = { ...analysis, presentation: { ...analysis.presentation, facts: [{ ...analysis.presentation.facts[0], sourceBlockIds: [], provenance: { kind: "legacy", sourceId: null, revision: null, capturedAt: null } }] } };
  assert.equal(isAnalysis(orphanKnownFact, NOW), false, "a known legacy fact requires a canonical human source block");
  const unresolved = { ...analysis, presentation: { ...analysis.presentation, facts: [{ ...analysis.presentation.facts[0], sourceBlockIds: ["notion-block-1"] }] } };
  assert.equal(isAnalysis(unresolved, NOW), false, "source IDs resolve against canonical IDs, not raw source IDs");
  assert.equal(isAnalysis({ ...analysis, presentation: { ...analysis.presentation, facts: [{ ...analysis.presentation.facts[0], value: Number.NaN }] } }, NOW), false);
  assert.equal(isAnalysis({ ...analysis, presentation: { ...analysis.presentation, thresholds: [{ ...analysis.presentation.thresholds[0], value: "12%", status: "known", asOf: "2026-09-29", sourceBlockIds: ["fact-source"] }] } }, NOW), false, "metrics are numeric even when facts may be text");
  assert.equal(isAnalysis({ ...analysis, presentation: { ...analysis.presentation, scenarios: [{ ...analysis.presentation.scenarios[0], cagrPercent: { ...analysis.presentation.scenarios[0].cagrPercent, value: "12%" } }] } }, NOW), false);
  const machineFact = { id: "external-price", label: "Captured price", value: 123, unit: "USD", status: "known", asOf: "2026-09-29", sourceBlockIds: [], provenance: { kind: "projection", sourceId: "source-1", revision: "rev-2", capturedAt: "2026-09-30T10:00:00Z" } };
  const machineScenario = { id: "external-base", label: "External base case", condition: "Conditions hold", impact: "Value supports thesis", status: "known", asOf: "2026-09-29", sourceBlockIds: [], provenance: machineFact.provenance, terminalValue: null, cagrPercent: null, horizon: null };
  const projectionBacked = { ...base("business"), score: null, presentation: { facts: [machineFact], scenarios: [machineScenario], thresholds: [] } };
  assert.equal(isAnalysis(projectionBacked, NOW), true, "verified projection provenance may originate structured facts without a human block reference");
  assert.equal(isAnalysis({ ...projectionBacked, presentation: { ...projectionBacked.presentation, scenarios: [{ ...machineScenario, provenance: { ...machineFact.provenance, capturedAt: null } }] } }, NOW), false, "projection scenario provenance must be attested");
});

test("projection status is a discriminated union and delegates projection schema validation", async () => {
  const { isProjectionState, isAnalysis } = await api();
  assert.equal(isProjectionState({ status: "absent" }, NOW), true);
  assert.equal(isProjectionState({ status: "invalid", diagnostic: { code: "projection_hash", message: "Report hash mismatch", severity: "warning" } }, NOW), true);
  assert.equal(isProjectionState({ status: "invalid" }, NOW), false);
  assert.equal(isProjectionState({ status: "valid", projection: minimalProjection() }, NOW), true);
  assert.equal(isProjectionState({ status: "valid", projection: { ...minimalProjection(), unknown: true } }, NOW), false);
  assert.equal(isProjectionState({ status: "valid", projection: minimalProjection(), diagnostic: "extra" }, NOW), false);
  const analysis = { ...base("business"), score: "82/100", projection: { status: "valid", projection: minimalProjection() } };
  assert.equal(isAnalysis(analysis, NOW), true);
  assert.equal(isAnalysis({ ...analysis, projection: { status: "valid", projection: { ...minimalProjection(), analysisType: "valuation" } } }, NOW), false, "business cannot carry a valuation projection");
  const valuation = { ...base("valuation"), header: header("valuation"), score: null, projection: { status: "valid", projection: { ...minimalProjection(), analysisType: "valuation" } } };
  assert.equal(isAnalysis(valuation, NOW), true);
  assert.equal(isAnalysis({ ...valuation, projection: { status: "valid", projection: { ...minimalProjection(), analysisType: "business" } } }, NOW), false, "valuation cannot carry a business projection");
  assert.equal(isAnalysis({ ...base("unknown", { projection: { status: "valid", projection: minimalProjection() } }), header: header("unknown", { originalFamily: "x" }) }, NOW), false, "unknown families cannot silently accept structured projections");
});

test("preview and service results are versioned, strict, and cannot carry report bodies", async () => {
  const { isAnalysisPreview } = await api();
  const { validateServiceResult } = await importCommon();
  const preview = {
    ...header("business"), summary: "One line", handoffSummary: null, previewSummaryItems: ["Stable demand"], score: "82/100",
    verdict: "Conserver", confidence: "High", projectionStatus: "absent", diagnostics: [],
  };
  assert.equal(isAnalysisPreview(preview, NOW), true);
  assert.equal(isAnalysisPreview({ ...preview, body: "full Notion report" }, NOW), false);
  assert.equal(isAnalysisPreview({ ...preview, notionBlocks: [] }, NOW), false);
  assert.equal(isAnalysisPreview({ ...preview, projectionStatus: "stale" }, NOW), false);
  assert.equal(isAnalysisPreview({ ...preview, ...header("cio_memo"), score: "82/100" }, NOW), false, "memo previews cannot expose financial scores");

  const metadata = { revision: "rev-1", freshness: "fresh", provenance: provenance(), diagnostics: [] };
  const ok = { schemaVersion: "1.0.0", status: "ok", data: preview, metadata };
  assert.equal(validateServiceResult(ok, isAnalysisPreview, NOW), true);
  assert.equal(validateServiceResult({ ...ok, schemaVersion: "2.0.0" }, isAnalysisPreview, NOW), false);
  assert.equal(validateServiceResult({ ...ok, metadata: { ...metadata, extra: true } }, isAnalysisPreview, NOW), false);
  const error = { schemaVersion: "1.0.0", status: "error", error: { code: "not_found", message: "No analysis", retryable: false }, metadata: { ...metadata, freshness: "unknown", provenance: null } };
  assert.equal(validateServiceResult(error, isAnalysisPreview, NOW), true);
  assert.equal(validateServiceResult({ ...error, error: { ...error.error, code: "mystery" } }, isAnalysisPreview, NOW), false);
});
