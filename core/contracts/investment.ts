import {
  SCHEMA_VERSION,
  hasExactKeys,
  isFiniteNumber,
  isIsoDateTime,
  isIsoDateOrDateTime as isIsoDate,
  isStringArray,
  isNonEmptyString,
  isRecord as isObject,
  type Provenance,
  type ServiceResult,
  validateProvenance as isProvenance,
  validateServiceResult,
} from "./common";
import { isAnalysisPreview, type AnalysisPreview } from "./analysis";

export const investmentContractVersion = SCHEMA_VERSION;

export type ResearchReferenceKind = "business" | "valuation" | "short" | "portfolio" | "memo";
export type ResearchReference = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  kind: ResearchReferenceKind;
  title: string;
  agent: string;
  score: string;
  verdict: string;
  confidence: string | null;
  status: string;
  date: string | null;
  lastEditedTime: string;
  notionUrl: string;
  provenance: Provenance;
};

/** Stable company identity and metadata; document bodies belong to analysis contracts. */
export type Company = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  ticker: string;
  sector: string;
  industry: string;
  ownershipStatus: "Owned" | "Not owned";
  watchlistMembership: boolean;
  monitoringStatus: string;
  businessScore: number | null;
  businessVerdict: string;
  researchStage: string;
  researchPriority: string;
  lastAnalysis: string | null;
  themes: string[];
  country: string;
  currency: string;
  exchange: string;
  dataCompleteness: string;
  notionUrl: string;
  researchReferences: ResearchReference[];
  provenance: Provenance;
};

/** A company detail response contains headers and summaries, never raw report bodies. */
export type CompanyPreview = Company & {
  analyses: AnalysisPreview[];
  earnings: AnalysisPreview[];
  decisions: AnalysisPreview[];
  portfolioDocuments: AnalysisPreview[];
  archives: AnalysisPreview[];
};

export type Exposure = { name: string; weight: number };
export type PositionBase = {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  targetId: string;
  name: string;
  instrumentType: string;
  account: string;
  sector: string;
  industry: string;
  themes: string[];
  primaryTheme: string;
  country: string | null;
  countryExposures: Exposure[];
  sectorExposures: Exposure[];
  themeExposures: Exposure[];
  quantity: number;
  pruEur: number | null;
  brokerPruEur: number | null;
  pruSource: "notion-pru" | "notion-broker-pru" | "missing";
  costBasisEur: number;
  brokerCostBasisEur: number;
  marketValueEur: number | null;
  pnlEur: number | null;
  pnlPercent: number | null;
  brokerPnlEur: number | null;
  brokerPnlPercent: number | null;
  weight: number | null;
  targetWeight: number;
  targetEur: number;
  target10kWeight: number;
  target10kEur: number;
  quoteSymbol: string | null;
  nativePrice: number | null;
  nativeCurrency: string;
  eurPrice: number | null;
  fxRate: number | null;
  fxMarketTime: string | null;
  fetchedAt: string | null;
  quoteWarnings: string[];
  changePercent: number | null;
  quoteSource: string;
  quoteFreshness: string;
  marketTime: string | null;
  companyIds: string[];
  notionUrl: string;
  warning: string | null;
  provenance: Provenance;
};

/** Open positions are holdings; closed positions stay individually addressable outside holdings. */
export type OpenPosition = PositionBase & { lifecycle: "open" };
export type Position = OpenPosition | ClosedPosition;
export type ClosedPosition = PositionBase & { lifecycle: "closed"; closedAt?: string | null };
export type TargetLine = { id: string; name: string; target10kWeight: number; target10kEur: number; target25kWeight: number; target25kEur: number };
export type PortfolioSlice = { marketValueEur: number; investedValueEur: number; cashValueEur: number; costBasisEur: number; pnlEur: number; pnlPercent: number | null; brokerCostBasisEur: number; brokerPnlEur: number; brokerPnlPercent: number | null; positions: number };
export type ReconciliationIssue = { positionId: string | null; positionName: string | null; severity: "warning" | "error"; code: string; message: string };

export type Portfolio = {
  schemaVersion: typeof SCHEMA_VERSION;
  generatedAt: string;
  quoteAsOf: string | null;
  oldestQuoteAsOf: string | null;
  targetSource: string;
  targetLines: TargetLine[];
  targetTotals: { target10kWeight: number; target25kWeight: number };
  totals: PortfolioSlice;
  slices: Record<string, PortfolioSlice>;
  positions: OpenPosition[];
  closedPositions?: ClosedPosition[];
  refreshPending?: boolean;
  sectors: { name: string; valueEur: number; weight: number }[];
  coverage: { live: number; manual: number; stale: number; unavailable: number; cash: number; total: number };
  reconciliation: {
    status: "ok" | "warning" | "error";
    coherent: number;
    warnings: number;
    errors: number;
    issues: ReconciliationIssue[];
    accountChecks: Record<string, { linesValueEur: number; sliceValueEur: number; deltaEur: number }>;
  };
  calculation: { pnlScope: "unrealized-open-positions"; realizedPnlAvailable: false; feesIncluded: false; dividendsIncluded: false; source: string };
  provenance: Provenance;
};

export type Quote = {
  schemaVersion: typeof SCHEMA_VERSION;
  assetId: string;
  name: string;
  nativePrice: number | null;
  nativeCurrency: string | null;
  eurPrice: number | null;
  fxRate: number | null;
  fxMarketTime: string | null;
  previousClose: number | null;
  changePercent: number | null;
  marketTime: string | null;
  fetchedAt: string | null;
  source: string | null;
  freshness: "fresh" | "closed" | "stale" | "unavailable";
  isFallback: boolean;
  warnings: string[];
  provenance: Provenance;
};

const isText = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isNullable = <T>(value: unknown, guard: (candidate: unknown) => candidate is T): value is T | null => value === null || guard(value);
const isNullableDate = (value: unknown): value is string | null => value === null || isIsoDate(value);
function hasKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every(key => key in value) && Object.keys(value).every(key => allowed.has(key));
}

export function isResearchReference(value: unknown): value is ResearchReference {
  return hasExactKeys(value, ["schemaVersion", "id", "kind", "title", "agent", "score", "verdict", "confidence", "status", "date", "lastEditedTime", "notionUrl", "provenance"]) && value.schemaVersion === SCHEMA_VERSION && isText(value.id) && ["business", "valuation", "short", "portfolio", "memo"].includes(String(value.kind)) &&
    isText(value.title) && isText(value.agent) && isText(value.score) && isText(value.verdict) && isNullable(value.confidence, isText) &&
    isText(value.status) && isNullableDate(value.date) && isIsoDateTime(value.lastEditedTime) && isText(value.notionUrl) && isProvenance(value.provenance);
}

export function isCompany(value: unknown): value is Company {
  return hasExactKeys(value, ["schemaVersion", "id", "name", "ticker", "sector", "industry", "ownershipStatus", "watchlistMembership", "monitoringStatus", "businessScore", "businessVerdict", "researchStage", "researchPriority", "lastAnalysis", "themes", "country", "currency", "exchange", "dataCompleteness", "notionUrl", "researchReferences", "provenance"]) && value.schemaVersion === SCHEMA_VERSION && isNonEmptyString(value.id) && isNonEmptyString(value.name) && isText(value.ticker) && isText(value.sector) && isText(value.industry) &&
    (value.ownershipStatus === "Owned" || value.ownershipStatus === "Not owned") && isBoolean(value.watchlistMembership) && isText(value.monitoringStatus) &&
    isNullable(value.businessScore, isFiniteNumber) && isText(value.businessVerdict) && isText(value.researchStage) && isText(value.researchPriority) &&
    isNullableDate(value.lastAnalysis) && isStringArray(value.themes) && isText(value.country) && isText(value.currency) && isText(value.exchange) &&
    isText(value.dataCompleteness) && isText(value.notionUrl) && Array.isArray(value.researchReferences) && value.researchReferences.every(isResearchReference) && new Set(value.researchReferences.map(reference => reference.id)).size === value.researchReferences.length && isProvenance(value.provenance);
}

export function isCompanyPreview(value: unknown): value is CompanyPreview {
  if (!isObject(value) || !hasKeys(value, ["schemaVersion", "id", "name", "ticker", "sector", "industry", "ownershipStatus", "watchlistMembership", "monitoringStatus", "businessScore", "businessVerdict", "researchStage", "researchPriority", "lastAnalysis", "themes", "country", "currency", "exchange", "dataCompleteness", "notionUrl", "researchReferences", "provenance", "analyses", "earnings", "decisions", "portfolioDocuments", "archives"]) ||
      !(value.analyses instanceof Array && value.earnings instanceof Array && value.decisions instanceof Array && value.portfolioDocuments instanceof Array && value.archives instanceof Array)) return false;
  const { analyses, earnings, decisions, portfolioDocuments, archives, ...company } = value;
  if (!isCompany(company)) return false;
  const groups = [analyses, earnings, decisions, portfolioDocuments, archives];
  if (!groups.every(items => items.every(item => isAnalysisPreview(item)))) return false;
  const ids = groups.flatMap(items => items.map(item => item.id));
  return new Set(ids).size === ids.length;
}

export function isExposure(value: unknown): value is Exposure { return hasExactKeys(value, ["name", "weight"]) && isText(value.name) && isFiniteNumber(value.weight); }
function isPositionBase(value: unknown): value is PositionBase & { lifecycle?: unknown; closedAt?: unknown } {
  if (!hasKeys(value, ["schemaVersion", "id", "targetId", "name", "instrumentType", "account", "sector", "industry", "themes", "primaryTheme", "country", "countryExposures", "sectorExposures", "themeExposures", "quantity", "pruEur", "brokerPruEur", "pruSource", "costBasisEur", "brokerCostBasisEur", "marketValueEur", "pnlEur", "pnlPercent", "brokerPnlEur", "brokerPnlPercent", "weight", "targetWeight", "targetEur", "target10kWeight", "target10kEur", "quoteSymbol", "nativePrice", "nativeCurrency", "eurPrice", "fxRate", "fxMarketTime", "fetchedAt", "quoteWarnings", "changePercent", "quoteSource", "quoteFreshness", "marketTime", "companyIds", "notionUrl", "warning", "provenance"], ["lifecycle", "closedAt"]) || value.schemaVersion !== SCHEMA_VERSION) return false;
  const textKeys = ["id", "targetId", "name", "instrumentType", "account", "sector", "industry", "primaryTheme", "nativeCurrency", "quoteSource", "quoteFreshness", "notionUrl"];
  const numberKeys = ["quantity", "costBasisEur", "brokerCostBasisEur", "targetWeight", "targetEur", "target10kWeight", "target10kEur"];
  const nullableNumberKeys = ["pruEur", "brokerPruEur", "marketValueEur", "pnlEur", "pnlPercent", "brokerPnlEur", "brokerPnlPercent", "weight", "nativePrice", "eurPrice", "fxRate", "changePercent"];
  const nullableDateKeys = ["fxMarketTime", "fetchedAt", "marketTime"];
  return textKeys.every(key => isText(value[key])) && numberKeys.every(key => isFiniteNumber(value[key])) &&
    nullableNumberKeys.every(key => isNullable(value[key], isFiniteNumber)) && nullableDateKeys.every(key => isNullableDate(value[key])) &&
    ["id", "targetId", "name", "nativeCurrency", "notionUrl"].every(key => isNonEmptyString(value[key])) &&
    (value.country === null || isText(value.country)) && ["notion-pru", "notion-broker-pru", "missing"].includes(String(value.pruSource)) &&
    isStringArray(value.themes) && isArrayOf(value.countryExposures, isExposure) && isArrayOf(value.sectorExposures, isExposure) && isArrayOf(value.themeExposures, isExposure) &&
    isStringArray(value.quoteWarnings) && isStringArray(value.companyIds) && isNullable(value.warning, isText) && isProvenance(value.provenance) &&
    (value.nativeCurrency === "EUR" || value.fxRate !== null || value.eurPrice === null);
}
function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] { return Array.isArray(value) && value.every(guard); }
export function isOpenPosition(value: unknown): value is OpenPosition { return isPositionBase(value) && !("closedAt" in value) && value.lifecycle === "open"; }
export function isClosedPosition(value: unknown): value is ClosedPosition { return isPositionBase(value) && value.lifecycle === "closed" && (value.closedAt === undefined || isNullableDate(value.closedAt)); }
export function isPosition(value: unknown): value is Position { return isOpenPosition(value) || isClosedPosition(value); }

function isPortfolioSlice(value: unknown): value is PortfolioSlice {
  if (!hasExactKeys(value, ["marketValueEur", "investedValueEur", "cashValueEur", "costBasisEur", "pnlEur", "pnlPercent", "brokerCostBasisEur", "brokerPnlEur", "brokerPnlPercent", "positions"])) return false;
  return ["marketValueEur", "investedValueEur", "cashValueEur", "costBasisEur", "pnlEur", "brokerCostBasisEur", "brokerPnlEur"].every(key => isFiniteNumber(value[key])) && isNonnegativeInteger(value.positions) && isNullable(value.pnlPercent, isFiniteNumber) && isNullable(value.brokerPnlPercent, isFiniteNumber);
}
function isTargetLine(value: unknown): value is TargetLine { return hasExactKeys(value, ["id", "name", "target10kWeight", "target10kEur", "target25kWeight", "target25kEur"]) && isText(value.id) && isText(value.name) && ["target10kWeight", "target10kEur", "target25kWeight", "target25kEur"].every(key => isFiniteNumber(value[key])); }
function isPortfolio(value: unknown): value is Portfolio {
  if (!hasKeys(value, ["schemaVersion", "generatedAt", "quoteAsOf", "oldestQuoteAsOf", "targetSource", "targetLines", "targetTotals", "totals", "slices", "positions", "sectors", "coverage", "reconciliation", "calculation", "provenance"], ["closedPositions", "refreshPending"]) || value.schemaVersion !== SCHEMA_VERSION || (value.refreshPending !== undefined && !isBoolean(value.refreshPending)) || !isIsoDateTime(value.generatedAt) || !isNullableDate(value.quoteAsOf) || !isNullableDate(value.oldestQuoteAsOf) || !isText(value.targetSource)) return false;
  if (!isArrayOf(value.targetLines, isTargetLine) || !hasExactKeys(value.targetTotals, ["target10kWeight", "target25kWeight"]) || !isFiniteNumber(value.targetTotals.target10kWeight) || !isFiniteNumber(value.targetTotals.target25kWeight)) return false;
  if (!isPortfolioSlice(value.totals) || !isObject(value.slices) || !Object.values(value.slices).every(isPortfolioSlice)) return false;
  if (!isArrayOf(value.positions, isOpenPosition) || value.positions.some(position => position.quantity <= 0)) return false;
  const positions = value.positions;
  if (new Set(positions.map(position => position.id)).size !== positions.length) return false;
  const closedPositions = value.closedPositions;
  if (closedPositions !== undefined) {
    if (!isArrayOf(closedPositions, isClosedPosition)) return false;
    if (new Set(closedPositions.map(position => position.id)).size !== closedPositions.length) return false;
    if (closedPositions.some(position => positions.some(open => open.id === position.id))) return false;
  }
  if (!isArrayOf(value.sectors, isSector)) return false;
  const coverage = value.coverage;
  if (!hasExactKeys(coverage, ["live", "manual", "stale", "unavailable", "cash", "total"]) || !["live", "manual", "stale", "unavailable", "cash", "total"].every(key => isNonnegativeInteger(coverage[key]))) return false;
  const reconciliation = value.reconciliation;
  if (!hasExactKeys(reconciliation, ["status", "coherent", "warnings", "errors", "issues", "accountChecks"]) || !["ok", "warning", "error"].includes(String(reconciliation.status)) || !["coherent", "warnings", "errors"].every(key => isNonnegativeInteger(reconciliation[key])) || !Array.isArray(reconciliation.issues) || !isObject(reconciliation.accountChecks)) return false;
  if (!reconciliation.issues.every(item => hasExactKeys(item, ["positionId", "positionName", "severity", "code", "message"]) && isNullable(item.positionId, isText) && isNullable(item.positionName, isText) && ["warning", "error"].includes(String(item.severity)) && isText(item.code) && isText(item.message))) return false;
  if (!Object.values(reconciliation.accountChecks).every(item => hasExactKeys(item, ["linesValueEur", "sliceValueEur", "deltaEur"]) && ["linesValueEur", "sliceValueEur", "deltaEur"].every(key => isFiniteNumber(item[key])))) return false;
  const calculation = value.calculation;
  return hasExactKeys(calculation, ["pnlScope", "realizedPnlAvailable", "feesIncluded", "dividendsIncluded", "source"]) && calculation.pnlScope === "unrealized-open-positions" && calculation.realizedPnlAvailable === false && calculation.feesIncluded === false && calculation.dividendsIncluded === false && isText(calculation.source) && isProvenance(value.provenance);
}

export function isQuote(value: unknown): value is Quote {
  if (!hasExactKeys(value, ["schemaVersion", "assetId", "name", "nativePrice", "nativeCurrency", "eurPrice", "fxRate", "fxMarketTime", "previousClose", "changePercent", "marketTime", "fetchedAt", "source", "freshness", "isFallback", "warnings", "provenance"]) || value.schemaVersion !== SCHEMA_VERSION) return false;
  const numbers = isNullable(value.nativePrice, isFiniteNumber) && isNullable(value.eurPrice, isFiniteNumber) && isNullable(value.fxRate, isFiniteNumber) && isNullable(value.previousClose, isFiniteNumber) && isNullable(value.changePercent, isFiniteNumber);
  const freshnessValid = value.freshness === "unavailable"
    ? value.nativePrice === null && value.eurPrice === null
    : isFiniteNumber(value.nativePrice) && value.nativePrice > 0 && isNonEmptyString(value.source) && isIsoDateTime(value.marketTime) && isIsoDateTime(value.fetchedAt);
  const currencyValid = value.nativeCurrency === null
    ? value.freshness === "unavailable"
    : /^[A-Z]{3}$/.test(String(value.nativeCurrency));
  const fxValid = value.nativeCurrency === "EUR"
    ? value.fxRate === null || (isFiniteNumber(value.fxRate) && value.fxRate > 0)
    : value.fxRate === null
      ? value.eurPrice === null
      : isFiniteNumber(value.fxRate) && value.fxRate > 0 && isFiniteNumber(value.eurPrice) && value.eurPrice > 0;
  const eurPriceValid = value.eurPrice === null || (isFiniteNumber(value.eurPrice) && value.eurPrice > 0);
  return isNonEmptyString(value.assetId) && isNonEmptyString(value.name) && numbers && currencyValid && eurPriceValid &&
    (value.fxMarketTime === null || isIsoDateTime(value.fxMarketTime)) && isNullableDate(value.marketTime) && isNullableDate(value.fetchedAt) && isNullable(value.source, isText) &&
    ["fresh", "closed", "stale", "unavailable"].includes(String(value.freshness)) && freshnessValid && fxValid &&
    isBoolean(value.isFallback) && isStringArray(value.warnings) && isProvenance(value.provenance);
}

function isNonnegativeInteger(value: unknown): value is number { return Number.isInteger(value) && isFiniteNumber(value) && value >= 0; }
function isSector(value: unknown): value is { name: string; valueEur: number; weight: number } {
  return hasExactKeys(value, ["name", "valueEur", "weight"]) && isText(value.name) && isFiniteNumber(value.valueEur) && isFiniteNumber(value.weight);
}

export const validateCompany = isCompany;
export const validateCompanyPreview = isCompanyPreview;
export const validatePortfolio = isPortfolio;
export const validatePosition = isPosition;
export const validateQuote = isQuote;

export const validateCompanyResult = (value: unknown): value is ServiceResult<Company> => validateServiceResult(value, isCompany);
export const validateCompanyPreviewResult = (value: unknown): value is ServiceResult<CompanyPreview> => validateServiceResult(value, isCompanyPreview);
export const validatePortfolioResult = (value: unknown): value is ServiceResult<Portfolio> => validateServiceResult(value, isPortfolio);
export const validatePositionResult = (value: unknown): value is ServiceResult<Position> => validateServiceResult(value, isPosition);
export const validateQuoteResult = (value: unknown): value is ServiceResult<Quote> => validateServiceResult(value, isQuote);
