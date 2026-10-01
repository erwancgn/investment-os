import { SCHEMA_VERSION, isRecord, type Diagnostic, type ServiceErrorCode, type ServiceMetadata, type ServiceResult } from "../contracts/common.ts";
import { isAnalysis, isAnalysisPreview, type Analysis, type AnalysisPreview } from "../contracts/analysis.ts";
import { isCompanyPreview, isPosition, isQuote, validatePortfolio, type CompanyPreview, type Portfolio, type Position, type Quote } from "../contracts/investment.ts";
import { selectCurrentAnalysis, type CurrentAnalysisFamily, type CurrentSelectionInput } from "../analysis/current-selection.ts";
import type { InvestmentPorts, ListAnalysesParams, ReadOptions, SaveAnalysisInput, SaveAnalysisReceipt } from "./ports.ts";
export type { InvestmentPorts, ListAnalysesParams, ReadOptions, SaveAnalysisInput, SaveAnalysisReceipt } from "./ports.ts";

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
    value.analysisId === input.analysis.header.id && value.runId === input.runId &&
    (value.revision === null || validId(value.revision)) && flags.every(flag => typeof flag === "boolean") && statusConsistent &&
    Array.isArray(value.diagnostics) && value.diagnostics.every(d => !!d && typeof d.code === "string" && typeof d.message === "string" && ["info", "warning", "error"].includes(d.severity));
}

export function createInvestmentCore(ports: InvestmentPorts) {
  return {
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
    async saveAnalysis(input: SaveAnalysisInput): Promise<ServiceResult<SaveAnalysisReceipt>> {
      if (!saveInputValid(input)) return serviceError("invalid_input") as ServiceResult<SaveAnalysisReceipt>;
      if (!ports.writeAnalysis) return serviceError("dependency") as ServiceResult<SaveAnalysisReceipt>;
      try {
        const receipt = await ports.writeAnalysis(input);
        if (!validReceipt(receipt, input)) return serviceError("mapping") as ServiceResult<SaveAnalysisReceipt>;
        const result = ok(receipt, receipt.diagnostics);
        return { ...result, metadata: { revision: receipt.revision, freshness: "unknown", provenance: input.analysis.header.provenance, diagnostics: [...input.analysis.diagnostics, ...receipt.diagnostics] } };
      } catch (error) { return serviceError(errorCode(error)) as ServiceResult<SaveAnalysisReceipt>; }
    },
    getQuote(assetId: string, options?: ReadOptions): Promise<ServiceResult<Quote>> {
      if (!validId(assetId)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Quote>);
      if (!validReadOptions(options)) return Promise.resolve(serviceError("invalid_input") as ServiceResult<Quote>);
      return invoke(ports.readQuote ? () => ports.readQuote!(assetId, options) : undefined, value => isQuote(value) && value.assetId === assetId);
    },
  };
}
