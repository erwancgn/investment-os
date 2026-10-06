import { SCHEMA_VERSION, isRecord, type Diagnostic, type ServiceErrorCode, type ServiceMetadata, type ServiceResult } from "../contracts/common.ts";
import { isAnalysis, isAnalysisPreview, type Analysis, type AnalysisPreview } from "../contracts/analysis.ts";
import { isCompanyPreview, isPosition, isQuote, validatePortfolio, type CompanyPreview, type Portfolio, type Position, type Quote } from "../contracts/investment.ts";
import { selectCurrentAnalysis, type CurrentAnalysisFamily, type CurrentSelectionInput } from "../analysis/current-selection.ts";
import { exchangeKey, exchangeSuffixOf, identityKey, yahooSuffix } from "./market-identity.ts";
import type { CompanyCreation, CompanyIdentity, CompanyResolution, CreateCompanyInput, InvestmentPorts, ListAnalysesParams, ReadOptions, SaveAnalysisInput, SaveAnalysisReceipt, SaveReportInput } from "./ports.ts";
import { analysisFromReport, isReportInput } from "../analysis/report.ts";
export { quoteSymbolFor } from "./market-identity.ts";
export type { CompanyCreation, CompanyIdentity, CompanyResolution, CreateCompanyInput, InvestmentPorts, ListAnalysesParams, ReadOptions, SaveAnalysisInput, SaveAnalysisReceipt, SaveReportInput } from "./ports.ts";

const emptyMetadata = (): ServiceMetadata => ({ revision: null, freshness: "unknown", provenance: null, diagnostics: [] });
const messages: Record<ServiceErrorCode, string> = {
  invalid_input: "Les paramètres fournis ne sont pas valides.", unsupported_version: "La version du contrat n'est pas prise en charge.",
  not_found: "La ressource demandée est introuvable.", unauthorized: "Authentification requise.", forbidden: "Accès refusé.",
  mapping: "La source a retourné une donnée incompatible avec le contrat.", normalization: "La donnée n'a pas pu être normalisée.",
  storage: "La lecture ou l'écriture de la donnée a échoué.", dependency: "L'opération n'est pas disponible dans cet adapter.",
  rate_limit: "La dépendance limite temporairement les requêtes.", timeout: "L'opération a dépassé son délai.", network: "La dépendance est temporairement inaccessible.",
  cache: "Le cache n'a pas pu fournir la donnée.", stale_request: "La requête a été remplacée par une requête plus récente.",
};
const serviceError = (code: ServiceErrorCode, diagnostics: Diagnostic[] = []): ServiceResult<never> => ({
  schemaVersion: SCHEMA_VERSION, status: "error", error: { code, message: messages[code], retryable: ["dependency", "storage", "rate_limit", "timeout", "network", "cache"].includes(code) },
  metadata: { ...emptyMetadata(), diagnostics },
});
const ok = <T>(data: T, diagnostics: Diagnostic[] = []): ServiceResult<T> => {
  const metadata = metadataFor(data);
  return { schemaVersion: SCHEMA_VERSION, status: "ok", data, metadata: { ...metadata, diagnostics: [...metadata.diagnostics, ...diagnostics] } };
};

function metadataFor(data: unknown): ServiceMetadata {
  if (!data || typeof data !== "object") return emptyMetadata();
  const row = data as Record<string, unknown>;
  const analysis = (row.header && typeof row.header === "object" ? row.header : row) as Record<string, unknown>;
  const provenance = (analysis.provenance ?? row.provenance) as ServiceMetadata["provenance"] | undefined;
  const revision = typeof analysis.revision === "string" ? analysis.revision : provenance?.revision ?? null;
  const freshness = analysis.sourceFreshness === "fresh" || row.freshness === "fresh" ? "fresh" : analysis.sourceFreshness === "stale" || row.freshness === "stale" ? "stale" : "unknown";
  const diagnostics = Array.isArray(row.diagnostics) ? row.diagnostics.filter(isDiagnostic) : [];
  return { revision, freshness, provenance: provenance ?? null, diagnostics };
}
function isDiagnostic(value: unknown): value is Diagnostic {
  return isRecord(value) && typeof value.code === "string" && typeof value.message === "string" &&
    ["info", "warning", "error"].includes(String(value.severity)) &&
    (value.path === undefined || typeof value.path === "string");
}

function errorCode(error: unknown): ServiceErrorCode {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (["invalid_input", "unsupported_version", "not_found", "unauthorized", "forbidden", "mapping", "normalization", "storage", "dependency", "rate_limit", "timeout", "network", "cache", "stale_request"].includes(String(code))) return code as ServiceErrorCode;
  }
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: unknown }).name);
    if (name === "TimeoutError" || name === "AbortError") return "timeout";
  }
  return "storage";
}
async function invoke<T>(port: (() => Promise<T>) | undefined, validate: (value: unknown) => boolean): Promise<ServiceResult<T>> {
  if (!port) return serviceError("dependency") as ServiceResult<T>;
  try {
    const data = await port();
    if (!validate(data)) return serviceError("mapping") as ServiceResult<T>;
    return ok(data);
  } catch (error) { return serviceError(errorCode(error)) as ServiceResult<T>; }
}
function validId(id: string): boolean { return typeof id === "string" && id.length > 0 && id.trim() === id; }
const tickerKey = (value: string) => value.normalize("NFKC").trim().toLocaleUpperCase("en");
/** Ticker without a trailing exchange suffix ("SU.PA" → "SU"); a suffix is a dot plus 1–4 letters. */
const tickerBase = (value: string) => tickerKey(value).replace(/\.[A-Z]{1,4}$/, "");
const tickerMatches = (stored: string, query: string) => /^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(tickerKey(query)) && (tickerKey(stored) === tickerKey(query) || tickerBase(stored) === tickerBase(query));
const legalSuffix = /\s+(?:incorporated|inc|corporation|corp|company|co|limited|ltd|plc|holdings|holding|group|sa|se|ag|nv|n v|s a|spa|s p a)$/;
function companyBase(value: string) {
  let base = identityKey(value);
  while (legalSuffix.test(base)) base = base.replace(legalSuffix, "");
  return base;
}
/** ISO 6166: 2 letters, 9 alphanumerics, 1 Luhn check digit computed on the letter-expanded string. */
export function normalizeIsin(value: string): string | null {
  const isin = value.replace(/[\s-]+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return null;
  const digits = isin.split("").map(c => /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c).join("");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) { let d = Number(digits[digits.length - 1 - i]); if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0 ? isin : null;
}
/** "Schneider (SU)", "Alphabet - GOOGL", "MU/NASDAQ" → the whole query and each part. */
function queryVariants(query: string): string[] {
  const parts = [query, ...query.split(/[()[\]\/,|]|\s[-–]\s/)].map(part => part.trim()).filter(part => part.length > 0);
  return [...new Set(parts)];
}
const tokens = (value: string) => companyBase(value).split(" ").filter(Boolean);
/** Strength of an exact key: 3 ISIN / full ticker / name or alias, 2 ticker without its exchange suffix, 0 none. */
function exactStrength(item: CompanyIdentity, variant: string): number {
  const isin = normalizeIsin(variant);
  if (isin) return item.isin && normalizeIsin(item.isin) === isin ? 3 : 0;
  const base = companyBase(variant);
  if (base.length > 0 && (companyBase(item.canonicalName) === base || item.aliases.some(alias => companyBase(alias) === base))) return 3;
  if (!item.ticker || !tickerMatches(item.ticker, variant)) return 0;
  if (tickerKey(item.ticker) === tickerKey(variant)) return tickerBase(variant) !== tickerKey(variant) ? 3 : 2;
  // Same base, different full tickers: a contradicting exchange suffix or another share class is only a candidate (1).
  const querySuffix = tickerKey(variant).match(/\.([A-Z]{1,4})$/)?.[1] ?? null;
  if (querySuffix === null) return 2;
  const storedSuffix = exchangeSuffixOf(item.ticker) ?? yahooSuffix(item.exchange);
  return exchangeSuffixOf(variant) && storedSuffix === querySuffix ? 2 : 1;
}
/** Partial: every word of the query starts a word of the name (≥ 4 letters in total). Never resolves on its own. */
function partialMatch(item: CompanyIdentity, variant: string): boolean {
  const query = tokens(variant);
  if (query.join("").length < 4) return false;
  return [item.canonicalName, ...item.aliases].some(name => { const words = tokens(name); return query.every(q => words.some(w => w.startsWith(q))); });
}
function validIdentity(value: unknown): value is CompanyIdentity {
  return isRecord(value) && Object.keys(value).every(key => ["companyId", "canonicalName", "ticker", "exchange", "assetId", "aliases", "isin"].includes(key)) &&
    (value.isin === undefined || value.isin === null || typeof value.isin === "string") &&
    validId(value.companyId as string) && validId(value.canonicalName as string) && typeof value.ticker === "string" &&
    (value.exchange === null || typeof value.exchange === "string") && (value.assetId === null || typeof value.assetId === "string") &&
    Array.isArray(value.aliases) && value.aliases.every(alias => typeof alias === "string");
}
function validReadOptions(options?: ReadOptions): boolean {
  return options === undefined || (isRecord(options) && Object.keys(options).every(key => key === "force" || key === "cacheOnly") &&
    (options.force === undefined || typeof options.force === "boolean") && (options.cacheOnly === undefined || typeof options.cacheOnly === "boolean"));
}
function validListParams(params?: ListAnalysesParams): boolean {
  return params === undefined || (isRecord(params) && Object.keys(params).every(key => ["companyId", "family", "archived", "status"].includes(key)) &&
    (params.companyId === undefined || validId(params.companyId)) && (params.family === undefined || ["business", "valuation", "short", "portfolio", "cio_memo", "decision", "earnings", "generic", "unknown"].includes(params.family)) &&
    (params.archived === undefined || typeof params.archived === "boolean") && (params.status === undefined || typeof params.status === "string"));
}
function validFamily(family: string): family is CurrentAnalysisFamily { return ["business", "valuation", "short", "portfolio", "cio_memo", "decision", "earnings"].includes(family); }
function currentContextValid(context: unknown, companyId: string, family: CurrentAnalysisFamily): context is CurrentSelectionInput {
  if (!isRecord(context)) return false;
  const value = context as CurrentSelectionInput;
  return value.companyId === companyId && value.family === family && Array.isArray(value.explicitCurrentIds) && value.explicitCurrentIds.every(validId) &&
    Array.isArray(value.candidates) && value.candidates.every(candidate => isRecord(candidate) && typeof candidate.id === "string" && validId(candidate.id) &&
      ["business", "valuation", "short", "portfolio", "cio_memo", "decision", "earnings", "generic", "unknown"].includes(String(candidate.family)) &&
      ["analysis", "decision"].includes(String(candidate.sourceKind)) && (candidate.agent === null || typeof candidate.agent === "string") && typeof candidate.status === "string" &&
      (candidate.date === null || typeof candidate.date === "string") && typeof candidate.lastEditedTime === "string" && Array.isArray(candidate.companyIds) && candidate.companyIds.every(id => typeof id === "string") &&
      ["fresh", "stale", "unknown"].includes(String(candidate.sourceFreshness)) && typeof candidate.archived === "boolean" &&
      (candidate.relatedDates === undefined || Array.isArray(candidate.relatedDates) && candidate.relatedDates.every(date => typeof date === "string")));
}
function saveInputValid(input: SaveAnalysisInput): boolean {
  return !!input && isAnalysis(input.analysis) && validId(input.runId) &&
    (input.expectedRevision === null || validId(input.expectedRevision)) && Array.isArray(input.companyIds) &&
    input.companyIds.every(validId) && new Set(input.companyIds).size === input.companyIds.length &&
    input.companyIds.length === input.analysis.header.companyIds.length &&
    input.companyIds.every(id => input.analysis.header.companyIds.includes(id));
}
function validReceipt(receipt: unknown, input: SaveAnalysisInput): receipt is SaveAnalysisReceipt {
  if (!isRecord(receipt) || Object.keys(receipt).some(key => !["schemaVersion", "status", "analysisId", "runId", "revision", "persisted", "promoted", "verified", "diagnostics"].includes(key))) return false;
  const value = receipt as SaveAnalysisReceipt;
  const flags = [value.persisted, value.promoted, value.verified];
  const lifecycleConsistent = (!value.promoted || value.persisted) && (!value.verified || value.promoted);
  const statusConsistent = lifecycleConsistent && (value.status === "verified" ? flags.every(Boolean) : value.status === "persisted" ? value.persisted && !value.promoted && !value.verified : value.status === "promotion_pending" ? value.persisted && !value.promoted && !value.verified : value.status === "partial");
  return Object.keys(value).length === 9 && value.schemaVersion === SCHEMA_VERSION && ["persisted", "promotion_pending", "verified", "partial"].includes(value.status) &&
    // Create ports may assign identity; revisioned updates must preserve it.
    validId(value.analysisId) && (input.expectedRevision === null || value.analysisId === input.analysis.header.id) && value.runId === input.runId &&
    (value.revision === null || validId(value.revision)) && flags.every(flag => typeof flag === "boolean") && statusConsistent &&
    Array.isArray(value.diagnostics) && value.diagnostics.every(d => !!d && typeof d.code === "string" && typeof d.message === "string" && ["info", "warning", "error"].includes(d.severity));
}

const candidateOf = (item: CompanyIdentity) => ({ companyId: item.companyId, canonicalName: item.canonicalName, ticker: item.ticker, exchange: item.exchange, assetId: item.assetId, isin: item.isin ? normalizeIsin(item.isin) ?? item.isin : null });
/** One matcher for resolve_company and create_company duplicate checks. Exact keys resolve; partial keys only propose. */
export function matchCompanies(identities: CompanyIdentity[], query: string, market?: string): CompanyResolution {
  const variants = queryVariants(query);
  const marketKey = market ? exchangeKey(market) : null;
  const inMarket = (item: CompanyIdentity) => !marketKey || exchangeKey(item.exchange ?? "") === marketKey;
  // Rank by corroboration first (name AND ticker beats ticker alone), then by key strength (SU.PA beats SU).
  const score = (item: CompanyIdentity) => {
    const strengths = variants.map(variant => exactStrength(item, variant));
    const hits = variants.filter((variant, n) => strengths[n] > 0 || partialMatch(item, variant)).length;
    return { best: Math.max(0, ...strengths), hits };
  };
  const scored = identities.map(item => ({ item, ...score(item) }));
  const top = (rows: typeof scored) => { const max = Math.max(...rows.map(r => r.hits * 10 + r.best)); return rows.filter(r => r.hits * 10 + r.best === max).map(r => r.item); };
  // best 1 (contradicting suffix, other share class) never resolves: it is proposed for confirmation only.
  const exactRows = scored.filter(r => r.best >= 2);
  const weakRows = scored.filter(r => r.best === 1);
  const inMarketRows = exactRows.filter(r => inMarket(r.item));
  const partial = exactRows.length || weakRows.length ? [] : identities.filter(item => variants.some(variant => partialMatch(item, variant)));
  // The market narrows before ranking; a wrong or unknown market never hides a company: it is proposed for confirmation.
  const inMarketTop = inMarketRows.length ? top(inMarketRows) : [];
  const [status, matches]: [CompanyResolution["status"], CompanyIdentity[]] =
    inMarketTop.length === 1 ? ["resolved", inMarketTop]
    : inMarketTop.length > 1 ? ["ambiguous", inMarketTop]
    : exactRows.length ? ["ambiguous", top(exactRows)]
    : weakRows.length ? ["ambiguous", weakRows.map(r => r.item)]
    : partial.length ? ["ambiguous", partial]
    : ["not_found", []];
  const candidates = matches.map(candidateOf)
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName) || a.companyId.localeCompare(b.companyId));
  return { status, candidates };
}

/** Field rules for create_company; returns the normalized input or null. Values are never echoed. */
export function normalizeCreateCompany(value: unknown): CreateCompanyInput | null {
  if (!isRecord(value) || !Object.keys(value).every(key => ["name", "ticker", "exchange", "isin", "currency", "country"].includes(key))) return null;
  const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;
  const nullable = (v: unknown, max: number) => v === null || v === undefined ? null : text(v, max);
  const name = text(value.name, 200), ticker = typeof value.ticker === "string" ? tickerKey(value.ticker) : "";
  const isin = typeof value.isin === "string" ? normalizeIsin(value.isin) : null;
  const exchange = nullable(value.exchange, 64), country = nullable(value.country, 64);
  const currency = value.currency === null || value.currency === undefined ? null : typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency.trim()) ? value.currency.trim() : undefined;
  if (!name || !/^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(ticker) || !isin || currency === undefined) return null;
  if ((value.exchange != null && !exchange) || (value.country != null && !country)) return null;
  return { name, ticker, exchange, isin, currency, country };
}
/** Duplicate keys for creation: same ISIN, same name (legal form ignored), same full ticker, or same base ticker on the same exchange. */
export function companyDuplicates(identities: CompanyIdentity[], input: CreateCompanyInput) {
  const name = companyBase(input.name), market = input.exchange ? exchangeKey(input.exchange) : null;
  return identities.filter(item =>
    (item.isin && normalizeIsin(item.isin) === input.isin) ||
    companyBase(item.canonicalName) === name || item.aliases.some(alias => companyBase(alias) === name) ||
    (item.ticker && tickerKey(item.ticker) === input.ticker) ||
    (item.ticker && tickerBase(item.ticker) === tickerBase(input.ticker) && (!market || !item.exchange || exchangeKey(item.exchange) === market)));
}

export function createInvestmentCore(ports: InvestmentPorts) {
  return {
    async resolveCompany(query: string, market?: string): Promise<ServiceResult<CompanyResolution>> {
      if (!validId(query) || query.length > 512 || (market !== undefined && (!validId(market) || market.length > 128))) return serviceError("invalid_input") as ServiceResult<CompanyResolution>;
      if (!ports.readCompanyIdentities) return serviceError("dependency") as ServiceResult<CompanyResolution>;
      try {
        const identities = await ports.readCompanyIdentities();
        if (!Array.isArray(identities) || !identities.every(validIdentity) || new Set(identities.map(item => item.companyId)).size !== identities.length) return serviceError("mapping") as ServiceResult<CompanyResolution>;
        return ok(matchCompanies(identities, query, market));
      } catch (error) { return serviceError(errorCode(error)) as ServiceResult<CompanyResolution>; }
    },
    /** WRITE: cache duplicate check first (cheap, no mutation), then the port re-checks the live source and creates. */
    async createCompany(input: CreateCompanyInput): Promise<ServiceResult<CompanyCreation>> {
      const normalized = normalizeCreateCompany(input);
      if (!normalized) return serviceError("invalid_input") as ServiceResult<CompanyCreation>;
      if (!ports.readCompanyIdentities || !ports.createCompany) return serviceError("dependency") as ServiceResult<CompanyCreation>;
      try {
        const identities = await ports.readCompanyIdentities();
        if (!Array.isArray(identities) || !identities.every(validIdentity)) return serviceError("mapping") as ServiceResult<CompanyCreation>;
        const duplicates = companyDuplicates(identities, normalized);
        if (duplicates.length) return ok({ status: "existing", candidates: duplicates.map(candidateOf) });
        const created = await ports.createCompany(normalized);
        if (!isRecord(created) || !["created", "existing"].includes(created.status as string) || !Array.isArray(created.candidates) || !created.candidates.length) return serviceError("mapping") as ServiceResult<CompanyCreation>;
        return ok(created);
      } catch (error) { return serviceError(errorCode(error)) as ServiceResult<CompanyCreation>; }
    },
    getCompany(id: string): Promise<ServiceResult<CompanyPreview | null>> {
      if (!validId(id)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<CompanyPreview | null>);
      if (!ports.readCompany) return Promise.resolve(serviceError("dependency") as ServiceResult<CompanyPreview | null>);
      return invoke(() => ports.readCompany!(id), data => data === null || (isCompanyPreview(data) && data.id === id));
    },
    getPortfolio(options?: ReadOptions): Promise<ServiceResult<Portfolio>> {
      if (!validReadOptions(options)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Portfolio>);
      return invoke(ports.readPortfolio ? () => ports.readPortfolio!(options) : undefined, validatePortfolio);
    },
    getPosition(id: string, options?: ReadOptions): Promise<ServiceResult<Position | null>> {
      if (!validId(id)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Position | null>);
      if (!validReadOptions(options)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Position | null>);
      if (!ports.readPosition) return Promise.resolve(serviceError("dependency") as ServiceResult<Position | null>);
      return invoke(() => ports.readPosition!(id, options), data => data === null || (isPosition(data) && data.id === id));
    },
    getAnalysisById(id: string): Promise<ServiceResult<Analysis | null>> {
      if (!validId(id)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Analysis | null>);
      if (!ports.readAnalysis) return Promise.resolve(serviceError("dependency") as ServiceResult<Analysis | null>);
      return invoke(() => ports.readAnalysis!(id), data => data === null || (isAnalysis(data) && data.header.id === id));
    },
    listAnalyses(params?: ListAnalysesParams): Promise<ServiceResult<AnalysisPreview[]>> {
      if (!validListParams(params)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<AnalysisPreview[]>);
      return invoke(ports.listAnalyses ? () => ports.listAnalyses!(params) : undefined, value => Array.isArray(value) && value.every(item => isAnalysisPreview(item)));
    },
    async getCurrentAnalysis(companyId: string, family: CurrentAnalysisFamily): Promise<ServiceResult<Analysis | null>> {
      if (!validId(companyId) || !validFamily(family)) return serviceError("invalid_input") as ServiceResult<Analysis | null>;
      if (!ports.readCurrentContext || !ports.readAnalysis) return serviceError("dependency") as ServiceResult<Analysis | null>;
      try {
        const context = await ports.readCurrentContext(companyId, family);
        if (!currentContextValid(context, companyId, family)) return serviceError("mapping") as ServiceResult<Analysis | null>;
        const selection = selectCurrentAnalysis(context);
        if (selection.status === "invalid") return { ...serviceError("mapping", selection.diagnostics), metadata: { ...emptyMetadata(), diagnostics: selection.diagnostics } };
        if (selection.status === "absent") return { ...ok(null, selection.diagnostics), metadata: { ...emptyMetadata(), diagnostics: selection.diagnostics } };
        const analysis = await ports.readAnalysis(selection.analysis.id);
        if (!analysis) return serviceError("not_found", selection.diagnostics) as ServiceResult<Analysis | null>;
        if (!isAnalysis(analysis) || analysis.header.id !== selection.analysis.id || analysis.header.family !== family || analysis.header.sourceKind !== selection.analysis.sourceKind || analysis.header.archived || !analysis.header.companyIds.includes(companyId)) return serviceError("mapping", selection.diagnostics) as ServiceResult<Analysis | null>;
        return ok(analysis, selection.diagnostics);
      } catch (error) { return serviceError(errorCode(error)) as ServiceResult<Analysis | null>; }
    },
    async saveAnalysis(request: SaveAnalysisInput | SaveReportInput): Promise<ServiceResult<SaveAnalysisReceipt>> {
      let input = request as SaveAnalysisInput;
      if (isReportInput(request)) {
        if (!ports.renderReportContent || !ports.writeAnalysis) return serviceError("dependency") as ServiceResult<SaveAnalysisReceipt>;
        const built = analysisFromReport(request, ports.renderReportContent);
        if (!built.ok) return serviceError("invalid_input", [{ code: "report_input", message: built.issues.join("; "), severity: "error", path: "input" }]) as ServiceResult<SaveAnalysisReceipt>;
        input = built.input;
      }
      if (!saveInputValid(input)) return serviceError("invalid_input") as ServiceResult<SaveAnalysisReceipt>;
      if (!ports.writeAnalysis) return serviceError("dependency") as ServiceResult<SaveAnalysisReceipt>;
      try {
        const receipt = await ports.writeAnalysis(input);
        if (!validReceipt(receipt, input)) return serviceError("mapping") as ServiceResult<SaveAnalysisReceipt>;
        // A report's header id is synthesized: it may only come back on a partial receipt, flagged.
        const synthesized = isReportInput(request) && receipt.analysisId === input.analysis.header.id;
        if (synthesized && receipt.status !== "partial") return serviceError("mapping") as ServiceResult<SaveAnalysisReceipt>;
        const unresolved: Diagnostic[] = synthesized ? [{ code: "analysis_id_unresolved", message: "La page Notion n'est pas encore identifiée ; analysisId n'est pas un identifiant de page.", severity: "warning", path: "analysisId" }] : [];
        const result = ok(receipt, [...receipt.diagnostics, ...unresolved]);
        return { ...result, metadata: { revision: receipt.revision, freshness: "unknown", provenance: input.analysis.header.provenance, diagnostics: [...input.analysis.diagnostics, ...receipt.diagnostics, ...unresolved] } };
      } catch (error) {
        const code = errorCode(error), detail = (error as { detail?: unknown } | null)?.detail;
        // A provider-side input refusal names its rule (field-level, never content) instead of a bare invalid_input.
        const diagnostics: Diagnostic[] = code === "invalid_input" && typeof detail === "string" && detail ? [{ code: "write_input", message: detail, severity: "error", path: "input" }] : [];
        return serviceError(code, diagnostics) as ServiceResult<SaveAnalysisReceipt>;
      }
    },
    getQuote(assetId: string, options?: ReadOptions): Promise<ServiceResult<Quote>> {
      if (!validId(assetId)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Quote>);
      if (!validReadOptions(options)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Quote>);
      return invoke(ports.readQuote ? () => ports.readQuote!(assetId, options) : undefined, value => isQuote(value) && value.assetId === assetId);
    },
  };
}
