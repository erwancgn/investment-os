import {
  SCHEMA_VERSION,
  hasExactKeys,
  isEnumValue,
  isFiniteNumber,
  isIsoDateTime,
  isIsoDateOrDateTime,
  isNonEmptyString,
  isNullableString,
  isRecord,
  isSafeHttpUrl,
  isStringArray,
  type Diagnostic,
  type Freshness,
  type Provenance,
  type Validator,
  validateDiagnostic,
  validateProvenance,
} from "./common.ts";
import { validatePresentationProjection, type AnalysisPresentationProjection } from "./presentation-projection.ts";

export type AnalysisFamily = "business" | "valuation" | "short" | "portfolio" | "cio_memo" | "decision" | "earnings" | "generic" | "unknown";
export type AnalysisSourceKind = "analysis" | "decision";

export type AnalysisHeader = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  sourceUrl: string | null;
  family: AnalysisFamily;
  /** Original unmapped family/name retained when family is `unknown`. */
  originalFamily: string | null;
  sourceKind: AnalysisSourceKind;
  agent: string | null;
  status: string;
  date: string | null;
  lastEditedTime: string;
  companyIds: string[];
  /** Opaque source revision (for example the source last-edited timestamp). */
  revision: string;
  sourceFreshness: Freshness;
  /** True only when an explicit archive signal was mapped from the source. */
  archived: boolean;
  provenance: Provenance;
};

export type InlineMark = "bold" | "italic" | "strikethrough" | "code";
/** Flat marks preserve combined Notion annotations without React elements. */
export type InlineSegment = { text: string; marks: InlineMark[]; href: string | null };

type BlockBase = { id: string; sourceIds: string[] };
export type AnalysisBlock =
  | (BlockBase & { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: InlineSegment[] })
  | (BlockBase & { type: "paragraph" | "quote"; text: InlineSegment[] })
  | (BlockBase & { type: "callout"; text: InlineSegment[]; icon: string | null })
  | (BlockBase & { type: "list"; ordered: boolean; items: InlineSegment[][] })
  | (BlockBase & { type: "table"; rows: InlineSegment[][][]; header: boolean })
  | (BlockBase & { type: "divider" })
  | (BlockBase & { type: "unsupported"; sourceType: string; text: string | null; diagnostic: Diagnostic });

export type AnalysisContent = { schemaVersion: typeof SCHEMA_VERSION; blocks: AnalysisBlock[] };

export type AnalysisValueStatus = "known" | "unknown";
export type AnalysisFact = {
  id: string;
  label: string;
  value: string | number | null;
  unit: string | null;
  status: AnalysisValueStatus;
  asOf: string | null;
  sourceBlockIds: string[];
  provenance: Provenance;
};
export type AnalysisMetric = Omit<AnalysisFact, "value"> & { value: number | null };
export type AnalysisScenario = {
  id: string;
  label: string;
  condition: string | null;
  impact: string | null;
  status: AnalysisValueStatus;
  asOf: string | null;
  sourceBlockIds: string[];
  provenance: Provenance;
  terminalValue: AnalysisMetric | null;
  cagrPercent: AnalysisMetric | null;
  horizon: AnalysisMetric | null;
};
export type AnalysisPresentation = { facts: AnalysisFact[]; scenarios: AnalysisScenario[]; thresholds: AnalysisMetric[] };

export type ProjectionState =
  | { status: "absent" }
  | { status: "invalid"; diagnostic: Diagnostic }
  | { status: "valid"; projection: AnalysisPresentationProjection };

type AnalysisBase<F extends AnalysisFamily> = {
  schemaVersion: typeof SCHEMA_VERSION;
  kind: F;
  header: AnalysisHeader & { family: F };
  content: AnalysisContent;
  summary: string | null;
  verdict: string | null;
  confidence: string | null;
  presentation: AnalysisPresentation;
  projection: ProjectionState;
  diagnostics: Diagnostic[];
};

export type BusinessAnalysis = AnalysisBase<"business"> & { score: string | null };
export type ValuationAnalysis = AnalysisBase<"valuation"> & { score: string | null };
export type ShortAnalysis = AnalysisBase<"short">;
export type PortfolioFitAnalysis = AnalysisBase<"portfolio">;
export type MemoAnalysis = AnalysisBase<"cio_memo"> & { handoffSummary: string | null };
export type Decision = {
  schemaVersion: typeof SCHEMA_VERSION;
  action: string | null;
  outcome: string | null;
  account: string | null;
  instrumentType: string | null;
  currentWeight: string | null;
  maximumWeight: string | null;
  maximumEntryPrice: string | null;
  nextReview: string | null;
  confidence: string | null;
  coreThesis: string | null;
  entryCondition: string | null;
  executionPlan: string | null;
  fundingSource: string | null;
  catalyst: string | null;
  invalidationCriteria: string | null;
  keyRisk: string | null;
  reviewTrigger: string | null;
};
export type DecisionAnalysis = AnalysisBase<"decision"> & { decision: Decision };

export type EarningsRefreshKey = "business" | "valuation" | "short" | "portfolio" | "memo";
export type EarningsRefreshStatus = "not-needed" | "monitor" | "recommended" | "required" | "unknown";
export type EarningsRefresh = { key: EarningsRefreshKey; label: string; status: EarningsRefreshStatus; rawValue: string | null };
export type EarningsReview = {
  fiscalPeriod: string | null;
  guidance: string | null;
  guidanceVsConsensus: string | null;
  confidence: string | null;
  refreshes: EarningsRefresh[];
};
export type EarningsAnalysis = AnalysisBase<"earnings"> & { earningsReview: EarningsReview };
export type GenericAnalysis = AnalysisBase<"generic" | "unknown">;
export type Analysis = BusinessAnalysis | ValuationAnalysis | ShortAnalysis | PortfolioFitAnalysis | MemoAnalysis | DecisionAnalysis | EarningsAnalysis | GenericAnalysis;
export type AnalysisDocument = Analysis;

/** A list-card contract. Deliberately has no `content`, raw text or source blocks. */
export type AnalysisPreview = AnalysisHeader & {
  summary: string | null;
  handoffSummary: string | null;
  previewSummaryItems: string[];
  score: string | null;
  verdict: string | null;
  confidence: string | null;
  projectionStatus: ProjectionState["status"];
  diagnostics: Diagnostic[];
};

const families = ["business", "valuation", "short", "portfolio", "cio_memo", "decision", "earnings", "generic", "unknown"] as const;
const sourceKinds = ["analysis", "decision"] as const;
const freshnessValues = ["fresh", "stale", "unknown"] as const;
const inlineMarks = ["bold", "italic", "strikethrough", "code"] as const;
const blockTypes = ["heading", "paragraph", "quote", "callout", "list", "table", "divider", "unsupported"] as const;
const decisionKeys = ["schemaVersion", "action", "outcome", "account", "instrumentType", "currentWeight", "maximumWeight", "maximumEntryPrice", "nextReview", "confidence", "coreThesis", "entryCondition", "executionPlan", "fundingSource", "catalyst", "invalidationCriteria", "keyRisk", "reviewTrigger"] as const;
const earningsRefreshKeys = ["business", "valuation", "short", "portfolio", "memo"] as const;
const earningsRefreshStatuses = ["not-needed", "monitor", "recommended", "required", "unknown"] as const;

function uniqueNonEmptyStrings(value: unknown): value is string[] {
  return isStringArray(value, false) && value.every(isNonEmptyString) && new Set(value).size === value.length;
}

function hasKnownOrigin(sourceBlockIds: string[], provenance: Provenance): boolean {
  return sourceBlockIds.length > 0 || (provenance.kind === "projection"
    && isNonEmptyString(provenance.sourceId)
    && isNonEmptyString(provenance.revision)
    && provenance.capturedAt !== null);
}

const headerKeys = ["schemaVersion", "id", "title", "sourceUrl", "family", "originalFamily", "sourceKind", "agent", "status", "date", "lastEditedTime", "companyIds", "revision", "sourceFreshness", "archived", "provenance"] as const;
function isAnalysisHeaderFields(value: unknown, now?: number): value is AnalysisHeader {
  return hasExactKeys(value, headerKeys)
    && value.schemaVersion === SCHEMA_VERSION
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.title)
    && (value.sourceUrl === null || isSafeHttpUrl(value.sourceUrl))
    && isEnumValue(value.family, families)
    && isNullableString(value.originalFamily)
    && (value.family !== "unknown" || isNonEmptyString(value.originalFamily))
    && isEnumValue(value.sourceKind, sourceKinds)
    && (value.family === "decision" ? value.sourceKind === "decision" : value.sourceKind === "analysis")
    && (value.agent === null || isNonEmptyString(value.agent))
    && isNonEmptyString(value.status)
    && (value.date === null || isIsoDateOrDateTime(value.date, now))
    && isIsoDateTime(value.lastEditedTime, now)
    && Array.isArray(value.companyIds)
    && value.companyIds.every(isNonEmptyString)
    && new Set(value.companyIds).size === value.companyIds.length
    && isNonEmptyString(value.revision)
    && isEnumValue(value.sourceFreshness, freshnessValues)
    && typeof value.archived === "boolean"
    && validateProvenance(value.provenance, now);
}

export function isAnalysisHeader(value: unknown, now?: number): value is AnalysisHeader {
  return isAnalysisHeaderFields(value, now);
}

function isInlineSegment(value: unknown): value is InlineSegment {
  if (!hasExactKeys(value, ["text", "marks", "href"]) || typeof value.text !== "string" || value.text.length === 0
    || !Array.isArray(value.marks) || !value.marks.every(mark => isEnumValue(mark, inlineMarks))
    || new Set(value.marks).size !== value.marks.length
    || !(value.href === null || isSafeHttpUrl(value.href))) return false;
  return !value.marks.includes("code") || (value.marks.length === 1 && value.marks[0] === "code");
}

function isSegments(value: unknown): value is InlineSegment[] {
  return Array.isArray(value) && value.every(isInlineSegment);
}

function isAnalysisBlock(value: unknown): value is AnalysisBlock {
  if (!isRecord(value) || !isEnumValue(value.type, blockTypes) || !isNonEmptyString(value.id) || !uniqueNonEmptyStrings(value.sourceIds)) return false;
  switch (value.type) {
    case "heading":
      return hasExactKeys(value, ["id", "type", "sourceIds", "level", "text"])
        && isFiniteNumber(value.level) && Number.isInteger(value.level) && value.level >= 1 && value.level <= 6
        && isSegments(value.text);
    case "paragraph":
    case "quote":
      return hasExactKeys(value, ["id", "type", "sourceIds", "text"]) && isSegments(value.text);
    case "callout":
      return hasExactKeys(value, ["id", "type", "sourceIds", "text", "icon"]) && isSegments(value.text) && (value.icon === null || typeof value.icon === "string");
    case "list":
      return hasExactKeys(value, ["id", "type", "sourceIds", "ordered", "items"])
        && typeof value.ordered === "boolean" && Array.isArray(value.items) && value.items.every(isSegments);
    case "table":
      return hasExactKeys(value, ["id", "type", "sourceIds", "rows", "header"])
        && typeof value.header === "boolean" && Array.isArray(value.rows)
        && value.rows.every(row => Array.isArray(row) && row.every(isSegments));
    case "divider":
      return hasExactKeys(value, ["id", "type", "sourceIds"]);
    case "unsupported":
      return hasExactKeys(value, ["id", "type", "sourceIds", "sourceType", "text", "diagnostic"])
        && isNonEmptyString(value.sourceType)
        && (value.text === null || typeof value.text === "string")
        && validateDiagnostic(value.diagnostic);
  }
}

export function isAnalysisContent(value: unknown): value is AnalysisContent {
  if (!hasExactKeys(value, ["schemaVersion", "blocks"]) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.blocks)) return false;
  if (!value.blocks.every(isAnalysisBlock)) return false;
  const blockIds = value.blocks.map(block => block.id);
  return new Set(blockIds).size === blockIds.length;
}

export function isProjectionState(value: unknown, now?: number): value is ProjectionState {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (value.status === "absent") return hasExactKeys(value, ["status"]);
  if (value.status === "invalid") return hasExactKeys(value, ["status", "diagnostic"]) && validateDiagnostic(value.diagnostic);
  // Structural validation only. The adapter is responsible for verifyPresentationProjection(rawSnapshot)
  // before assigning `valid`; the domain contract does not repeat raw-report/evidence hash verification.
  return value.status === "valid"
    && hasExactKeys(value, ["status", "projection"])
    && validatePresentationProjection(value.projection, now);
}

export function isDecision(value: unknown): value is Decision {
  return hasExactKeys(value, decisionKeys)
    && value.schemaVersion === SCHEMA_VERSION
    && decisionKeys.filter(key => key !== "schemaVersion").every(key => isNullableString(value[key]));
}

function isEarningsReview(value: unknown): value is EarningsReview {
  if (!hasExactKeys(value, ["fiscalPeriod", "guidance", "guidanceVsConsensus", "confidence", "refreshes"])) return false;
  return [value.fiscalPeriod, value.guidance, value.guidanceVsConsensus, value.confidence].every(isNullableString)
    && Array.isArray(value.refreshes)
    && value.refreshes.every(item => hasExactKeys(item, ["key", "label", "status", "rawValue"])
      && isEnumValue(item.key, earningsRefreshKeys)
      && isNonEmptyString(item.label)
      && isEnumValue(item.status, earningsRefreshStatuses)
      && isNullableString(item.rawValue))
    && new Set(value.refreshes.map(item => item.key)).size === value.refreshes.length;
}

const baseKeys = ["schemaVersion", "kind", "header", "content", "summary", "verdict", "confidence", "presentation", "projection", "diagnostics"] as const;
function validateAnalysisBase(value: Record<string, unknown>, kind: AnalysisFamily, now?: number): boolean {
  return value.schemaVersion === SCHEMA_VERSION
    && value.kind === kind
    && isAnalysisHeader(value.header, now)
    && value.header.family === kind
    && isAnalysisContent(value.content)
    && isNullableString(value.summary)
    && isNullableString(value.verdict)
    && isNullableString(value.confidence)
    && isAnalysisPresentation(value.presentation, value.content, now)
    && isProjectionState(value.projection, now)
    && isProjectionCompatibleWithFamily(value.projection, kind)
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(validateDiagnostic);
}

function isProjectionCompatibleWithFamily(value: unknown, family: AnalysisFamily): boolean {
  if (!isRecord(value) || value.status !== "valid" || !isRecord(value.projection)) return true;
  const familyByProjectionType: Partial<Record<AnalysisFamily, string>> = {
    business: "business",
    valuation: "valuation",
    short: "short",
    portfolio: "portfolio",
    cio_memo: "cio",
    earnings: "earnings",
  };
  return familyByProjectionType[family] === value.projection.analysisType;
}

function isAnalysisFact(value: unknown, blockIds: Set<string>, now?: number): value is AnalysisFact {
  if (!hasExactKeys(value, ["id", "label", "value", "unit", "status", "asOf", "sourceBlockIds", "provenance"])) return false;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.label)
    || !(value.value === null || typeof value.value === "string" || isFiniteNumber(value.value))
    || !(value.unit === null || typeof value.unit === "string")
    || !isEnumValue(value.status, ["known", "unknown"] as const)
    || !(value.asOf === null || isIsoDateOrDateTime(value.asOf, now))
    || !isStringArray(value.sourceBlockIds) || new Set(value.sourceBlockIds).size !== value.sourceBlockIds.length
    || !value.sourceBlockIds.every(id => blockIds.has(id)) || !validateProvenance(value.provenance, now)) return false;
  if (value.status === "known") return value.value !== null && hasKnownOrigin(value.sourceBlockIds, value.provenance);
  return value.value === null && value.asOf === null && value.sourceBlockIds.length === 0;
}

function isAnalysisMetric(value: unknown, blockIds: Set<string>, now?: number): value is AnalysisMetric {
  return isAnalysisFact(value, blockIds, now) && (value.value === null || isFiniteNumber(value.value));
}

function isAnalysisPresentation(value: unknown, contentValue: unknown, now?: number): value is AnalysisPresentation {
  if (!hasExactKeys(value, ["facts", "scenarios", "thresholds"]) || !isAnalysisContent(contentValue)) return false;
  const blockIds = new Set(contentValue.blocks.map(block => block.id));
  if (!Array.isArray(value.facts) || !value.facts.every(fact => isAnalysisFact(fact, blockIds, now))) return false;
  if (!Array.isArray(value.thresholds) || !value.thresholds.every(threshold => isAnalysisMetric(threshold, blockIds, now))) return false;
  if (!Array.isArray(value.scenarios)) return false;
  const validScenarios = value.scenarios.every(scenario => {
    if (!hasExactKeys(scenario, ["id", "label", "condition", "impact", "status", "asOf", "sourceBlockIds", "provenance", "terminalValue", "cagrPercent", "horizon"])) return false;
    if (!isNonEmptyString(scenario.id) || !isNonEmptyString(scenario.label)
      || !(scenario.condition === null || typeof scenario.condition === "string")
      || !(scenario.impact === null || typeof scenario.impact === "string")
      || !isEnumValue(scenario.status, ["known", "unknown"] as const)
      || !(scenario.asOf === null || isIsoDateOrDateTime(scenario.asOf, now))
      || !isStringArray(scenario.sourceBlockIds) || new Set(scenario.sourceBlockIds).size !== scenario.sourceBlockIds.length
      || !scenario.sourceBlockIds.every(id => blockIds.has(id)) || !validateProvenance(scenario.provenance, now)) return false;
    const metrics = [scenario.terminalValue, scenario.cagrPercent, scenario.horizon];
    if (!metrics.every(metric => metric === null || isAnalysisMetric(metric, blockIds, now))) return false;
    if (scenario.status === "known") return isNonEmptyString(scenario.condition) && isNonEmptyString(scenario.impact) && hasKnownOrigin(scenario.sourceBlockIds, scenario.provenance);
    return scenario.condition === null && scenario.impact === null && scenario.asOf === null && scenario.sourceBlockIds.length === 0
      && metrics.every(metric => metric === null || (metric.status === "unknown" && metric.value === null));
  });
  return validScenarios
    && new Set(value.facts.map(fact => fact.id)).size === value.facts.length
    && new Set(value.scenarios.map(scenario => scenario.id)).size === value.scenarios.length
    && new Set(value.thresholds.map(threshold => threshold.id)).size === value.thresholds.length;
}

export function isAnalysis(value: unknown, now?: number): value is Analysis {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "business":
      return hasExactKeys(value, [...baseKeys, "score"]) && validateAnalysisBase(value, "business", now) && isNullableString(value.score);
    case "valuation":
      return hasExactKeys(value, [...baseKeys, "score"]) && validateAnalysisBase(value, "valuation", now) && isNullableString(value.score);
    case "short":
    case "portfolio":
      return hasExactKeys(value, baseKeys) && validateAnalysisBase(value, value.kind, now);
    case "cio_memo":
      return hasExactKeys(value, [...baseKeys, "handoffSummary"]) && validateAnalysisBase(value, "cio_memo", now) && isNullableString(value.handoffSummary);
    case "decision":
      return hasExactKeys(value, [...baseKeys, "decision"]) && validateAnalysisBase(value, "decision", now) && isDecision(value.decision);
    case "earnings":
      return hasExactKeys(value, [...baseKeys, "earningsReview"]) && validateAnalysisBase(value, "earnings", now) && isEarningsReview(value.earningsReview);
    case "generic":
    case "unknown":
      return hasExactKeys(value, baseKeys) && validateAnalysisBase(value, value.kind, now);
    default:
      return false;
  }
}

export const validateAnalysis: Validator<Analysis> = isAnalysis;

export function isAnalysisPreview(value: unknown, now?: number): value is AnalysisPreview {
  return hasExactKeys(value, [...headerKeys, "summary", "handoffSummary", "previewSummaryItems", "score", "verdict", "confidence", "projectionStatus", "diagnostics"])
    && value.schemaVersion === SCHEMA_VERSION
    && isAnalysisHeaderFields(Object.fromEntries(headerKeys.map(key => [key, value[key]])), now)
    && isNullableString(value.summary)
    && isNullableString(value.handoffSummary)
    && isStringArray(value.previewSummaryItems)
    && isNullableString(value.score)
    && (value.family === "business" || value.family === "valuation" || value.score === null)
    && isNullableString(value.verdict)
    && isNullableString(value.confidence)
    && isEnumValue(value.projectionStatus, ["valid", "absent", "invalid"] as const)
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(validateDiagnostic);
}

export const validateAnalysisPreview: Validator<AnalysisPreview> = isAnalysisPreview;
