/** Typed, fail-closed contract for the plugin's analysis presentation projection.
 * The projection is a compact index of evidenced facts; Notion blocks remain
 * the report body and the legacy renderer remains the fallback. */
export type ProjectionStatus = "valid" | "absent" | "invalid";

export type AnalysisPresentationProjection = {
  presentationContractVersion: "1.0.0";
  analysisType: "business" | "earnings" | "valuation" | "short" | "portfolio" | "cio";
  identity: { company: string; ticker: string; exchange: string | null; currency: string | null; evidenceIds: string[] };
  generatedAt: string;
  reportSha256: string;
  summary: { text: string; evidenceIds: string[] };
  facts: ProjectionFact[];
  scenarios: ProjectionScenario[];
  thresholds: ProjectionMetric[];
  sources: ProjectionSource[];
  evidence: ProjectionEvidence[];
  freshnessChecks: ProjectionFreshnessCheck[];
  provenance: { runId: string; pluginVersion: string; contractVersion: "1.2.6" };
};

export type ProjectionMetric = { id: string; label: string; value: number | null; unit: string; status: "known" | "unknown"; asOf: string | null; evidenceIds: string[] };
export type ProjectionFact = { id: string; label: string; value: string | number | null; unit: string | null; status: "known" | "unknown"; asOf: string | null; evidenceIds: string[] };
export type ProjectionScenario = {
  id: string; label: string; condition: string; impact: string; status: "known" | "unknown"; asOf: string | null; evidenceIds: string[];
  terminalValue?: ProjectionMetric; cagrPercent?: ProjectionMetric; horizon?: ProjectionMetric; currency?: string;
};
export type ProjectionDataCategory = "market_price" | "financial_results" | "corporate_filing" | "market_structure" | "guidance" | "other";
export type ProjectionSource = { id: string; title: string; url: string; publishedAt: string | null; retrievedAt: string; asOf: string | null; dataCategory: ProjectionDataCategory; fiscalPeriod?: string; freshness: "known" | "unknown"; provenance: "collected_this_run" | "baseline"; publisher?: string };
export type ProjectionEvidence = { id: string; sourceId: string; claim: string; locator: string; supportingData: string; supportingDataSha256: string; captureMethod: "source_retrieval"; capturedAt: string; asOf: string | null; freshness: "known" | "unknown"; freshnessCheckId: string };
export type ProjectionFreshnessCheck = { id: string; dataCategory: ProjectionDataCategory; method: "market_calendar_and_latest_quote" | "latest_results_or_filings_search" | "latest_source_search"; result: "latest_verified" | "newer_found" | "unknown"; checkedAt: string; checkedSourceIds: string[]; supportingData: string; supportingDataSha256: string; captureMethod: "source_retrieval"; capturedAt: string; locator: string };

export type ProjectionExtraction = {
  status: ProjectionStatus;
  projection: AnalysisPresentationProjection | null;
  error: string | null;
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MODULES = new Set(["business", "earnings", "valuation", "short", "portfolio", "cio"]);

function nonEmptyString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isoDate(value: unknown, nullable = false, now = Date.now()): value is string | null {
  if (value === null) return nullable;
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value) || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && milliseconds <= now;
}
function ids(value: unknown, known: Set<string>, required: boolean): value is string[] {
  return Array.isArray(value) && (!required || value.length > 0)
    && value.every(item => typeof item === "string" && ID.test(item) && known.has(item))
    && new Set(value).size === value.length;
}
function exactKeys(value: RecordValue, allowed: string[]): boolean { return Object.keys(value).every(key => allowed.includes(key)); }
function hasKeys(value: RecordValue, required: string[]): boolean { return required.every(key => Object.prototype.hasOwnProperty.call(value, key)); }
function supportedPluginVersion(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) return false;
  const [major, minor, patch] = value.split(".").map(Number);
  return major > 1 || (major === 1 && (minor > 2 || (minor === 2 && patch >= 6)));
}

function supportsValue(refs: unknown, value: string | number | null, evidence: Map<string, ProjectionEvidence>): boolean {
  if (value === null || !Array.isArray(refs)) return false;
  const values = refs.map(ref => { const item = evidence.get(String(ref)); return item?.freshness === "known" ? item.supportingData : ""; });
  if (typeof value === "string") return values.some(source => source.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()));
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`(^|[^0-9.])${escaped}(?![0-9.])`);
  return values.some(source => matcher.test(source.replace(/,/g, "")));
}
function referencesKnownEvidence(refs: unknown, evidence: Map<string, ProjectionEvidence>): boolean {
  return Array.isArray(refs) && refs.length > 0 && refs.every(ref => evidence.get(String(ref))?.freshness === "known");
}

function validateMetric(value: unknown, evidenceIds: Set<string>, evidence: Map<string, ProjectionEvidence>, now: number): boolean {
  const item = record(value);
  if (!exactKeys(item, ["id", "label", "value", "unit", "status", "asOf", "evidenceIds"])
    || !hasKeys(item, ["id", "label", "value", "unit", "status", "asOf", "evidenceIds"])
    || typeof item.id !== "string" || !ID.test(item.id) || !nonEmptyString(item.label)
    || !nonEmptyString(item.unit) || !["known", "unknown"].includes(String(item.status))) return false;
  if (item.status === "known") return typeof item.value === "number" && Number.isFinite(item.value)
    && isoDate(item.asOf, false, now) && ids(item.evidenceIds, evidenceIds, true) && referencesKnownEvidence(item.evidenceIds, evidence) && supportsValue(item.evidenceIds, item.value as string | number | null, evidence);
  return item.value === null && item.asOf === null && Array.isArray(item.evidenceIds) && item.evidenceIds.length === 0;
}

function validateFact(value: unknown, evidenceIds: Set<string>, evidence: Map<string, ProjectionEvidence>, now: number): boolean {
  const item = record(value);
  if (!exactKeys(item, ["id", "label", "value", "unit", "status", "asOf", "evidenceIds"])
    || !hasKeys(item, ["id", "label", "value", "unit", "status", "asOf", "evidenceIds"])
    || typeof item.id !== "string" || !ID.test(item.id) || !nonEmptyString(item.label)
    || !(item.unit === null || nonEmptyString(item.unit)) || !["known", "unknown"].includes(String(item.status))) return false;
  if (item.status === "known") return item.value !== null && (typeof item.value === "string" ? item.value.trim().length > 0 : typeof item.value === "number" && Number.isFinite(item.value))
    && isoDate(item.asOf, false, now) && ids(item.evidenceIds, evidenceIds, true) && referencesKnownEvidence(item.evidenceIds, evidence) && supportsValue(item.evidenceIds, item.value as string | number | null, evidence);
  return item.value === null && item.asOf === null && Array.isArray(item.evidenceIds) && item.evidenceIds.length === 0;
}

export function validatePresentationProjection(value: unknown, now = Date.now()): value is AnalysisPresentationProjection {
  const root = record(value);
  const rootKeys = ["presentationContractVersion", "analysisType", "identity", "generatedAt", "reportSha256", "summary", "facts", "scenarios", "thresholds", "sources", "evidence", "freshnessChecks", "provenance"];
  if (!exactKeys(root, rootKeys) || !hasKeys(root, rootKeys) || root.presentationContractVersion !== "1.0.0" || !MODULES.has(String(root.analysisType))) return false;
  const identity = record(root.identity), summary = record(root.summary), provenance = record(root.provenance);
  if (!exactKeys(identity, ["company", "ticker", "exchange", "currency", "evidenceIds"]) || !hasKeys(identity, ["company", "ticker", "exchange", "currency", "evidenceIds"]) || !nonEmptyString(identity.company) || !nonEmptyString(identity.ticker) || !(identity.exchange === null || nonEmptyString(identity.exchange)) || !(identity.currency === null || nonEmptyString(identity.currency))) return false;
  if (!exactKeys(summary, ["text", "evidenceIds"]) || !hasKeys(summary, ["text", "evidenceIds"]) || !nonEmptyString(summary.text)) return false;
  if (!isoDate(root.generatedAt, false, now)) return false;
  if (!exactKeys(provenance, ["runId", "pluginVersion", "contractVersion"]) || !hasKeys(provenance, ["runId", "pluginVersion", "contractVersion"]) || !nonEmptyString(provenance.runId) || !supportedPluginVersion(provenance.pluginVersion) || provenance.contractVersion !== "1.2.6") return false;
  if (typeof root.reportSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.reportSha256)) return false;
  if (![root.sources, root.evidence, root.freshnessChecks, root.facts, root.scenarios, root.thresholds].every(Array.isArray)) return false;

  const sources = root.sources as unknown[], evidence = root.evidence as unknown[], freshnessChecks = root.freshnessChecks as unknown[];
  const sourceIds = new Set<string>(), evidenceIds = new Set<string>();
  for (const sourceValue of sources) {
    const source = record(sourceValue);
    const required = ["id", "title", "url", "publishedAt", "retrievedAt", "asOf", "dataCategory", "freshness", "provenance"];
    if (!exactKeys(source, [...required, "publisher", "fiscalPeriod"]) || !hasKeys(source, required) || typeof source.id !== "string" || !ID.test(source.id) || sourceIds.has(source.id) || !nonEmptyString(source.title) || typeof source.url !== "string" || !source.url.startsWith("https://") || !isoDate(source.publishedAt, true, now) || !isoDate(source.retrievedAt, false, now) || !isoDate(source.asOf, true, now) || !["market_price", "financial_results", "corporate_filing", "market_structure", "guidance", "other"].includes(String(source.dataCategory)) || !["known", "unknown"].includes(String(source.freshness)) || !["collected_this_run", "baseline"].includes(String(source.provenance)) || (source.publisher !== undefined && !nonEmptyString(source.publisher)) || (source.fiscalPeriod !== undefined && !nonEmptyString(source.fiscalPeriod))) return false;
    if ((source.freshness === "known") !== (source.asOf !== null)) return false;
    sourceIds.add(source.id as string);
  }
  for (const evidenceValue of evidence) {
    const item = record(evidenceValue);
    const required = ["id", "sourceId", "claim", "locator", "supportingData", "supportingDataSha256", "captureMethod", "capturedAt", "asOf", "freshness", "freshnessCheckId"];
    if (!exactKeys(item, required) || !hasKeys(item, required) || typeof item.id !== "string" || !ID.test(item.id) || evidenceIds.has(item.id) || typeof item.sourceId !== "string" || !sourceIds.has(item.sourceId) || !nonEmptyString(item.claim) || !nonEmptyString(item.locator) || !nonEmptyString(item.supportingData) || typeof item.supportingDataSha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.supportingDataSha256) || item.captureMethod !== "source_retrieval" || !isoDate(item.capturedAt, false, now) || !isoDate(item.asOf, true, now) || !["known", "unknown"].includes(String(item.freshness)) || typeof item.freshnessCheckId !== "string") return false;
    if ((item.freshness === "known") !== (item.asOf !== null)) return false;
    evidenceIds.add(item.id as string);
  }
  const freshnessIds = new Set<string>();
  for (const checkValue of freshnessChecks) {
    const check = record(checkValue);
    const required = ["id", "dataCategory", "method", "result", "checkedAt", "checkedSourceIds", "supportingData", "supportingDataSha256", "captureMethod", "capturedAt", "locator"];
    if (!exactKeys(check, required) || !hasKeys(check, required) || typeof check.id !== "string" || !ID.test(check.id) || freshnessIds.has(check.id) || !["market_price", "financial_results", "corporate_filing", "market_structure", "guidance", "other"].includes(String(check.dataCategory)) || !["market_calendar_and_latest_quote", "latest_results_or_filings_search", "latest_source_search"].includes(String(check.method)) || !["latest_verified", "newer_found", "unknown"].includes(String(check.result)) || !isoDate(check.checkedAt, false, now) || !ids(check.checkedSourceIds, sourceIds, true) || !nonEmptyString(check.supportingData) || typeof check.supportingDataSha256 !== "string" || !/^[a-f0-9]{64}$/.test(check.supportingDataSha256) || check.captureMethod !== "source_retrieval" || !isoDate(check.capturedAt, false, now) || !nonEmptyString(check.locator)) return false;
    freshnessIds.add(check.id as string);
  }
  const evidenceById = new Map(evidence.map(item => [String(record(item).id), record(item) as unknown as ProjectionEvidence]));
  const freshnessById = new Map(freshnessChecks.map(item => [String(record(item).id), record(item) as unknown as ProjectionFreshnessCheck]));
  for (const item of evidenceById.values()) {
    const check = freshnessById.get(item.freshnessCheckId);
    const source = sources.map(record).find(candidate => candidate.id === item.sourceId);
    if (!check || !check.checkedSourceIds.includes(item.sourceId) || !source || source.dataCategory !== check.dataCategory || source.freshness !== item.freshness
      || (item.freshness === "known" ? check.result !== "latest_verified" : check.result !== "unknown")) return false;
  }
  if (!ids(identity.evidenceIds, evidenceIds, true) || !referencesKnownEvidence(identity.evidenceIds, evidenceById) || !ids(summary.evidenceIds, evidenceIds, true) || !referencesKnownEvidence(summary.evidenceIds, evidenceById)) return false;
  for (const fact of root.facts as unknown[]) if (!validateFact(fact, evidenceIds, evidenceById, now)) return false;
  for (const threshold of root.thresholds as unknown[]) if (!validateMetric(threshold, evidenceIds, evidenceById, now)) return false;
  for (const value of root.scenarios as unknown[]) {
    const scenario = record(value);
    const allowed = ["id", "label", "condition", "impact", "status", "asOf", "evidenceIds", "terminalValue", "cagrPercent", "horizon", "currency"];
    const required = ["id", "label", "condition", "impact", "status", "asOf", "evidenceIds"];
    if (!exactKeys(scenario, allowed) || !hasKeys(scenario, required) || typeof scenario.id !== "string" || !ID.test(scenario.id) || !nonEmptyString(scenario.label) || typeof scenario.condition !== "string" || typeof scenario.impact !== "string" || !["known", "unknown"].includes(String(scenario.status)) || !(scenario.currency === undefined || nonEmptyString(scenario.currency))) return false;
    if (scenario.status === "known" ? !nonEmptyString(scenario.condition) || !nonEmptyString(scenario.impact) || !isoDate(scenario.asOf, false, now) || !ids(scenario.evidenceIds, evidenceIds, true) || !referencesKnownEvidence(scenario.evidenceIds, evidenceById) : scenario.condition !== "" || scenario.impact !== "" || scenario.asOf !== null || !Array.isArray(scenario.evidenceIds) || scenario.evidenceIds.length !== 0) return false;
    for (const metric of [scenario.terminalValue, scenario.cagrPercent, scenario.horizon]) if (metric !== undefined && !validateMetric(metric, evidenceIds, evidenceById, now)) return false;
  }
  return true;
}
