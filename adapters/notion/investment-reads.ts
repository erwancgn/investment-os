import { createNotionAnalysisWriter, type NotionWriteOptions } from "./analysis-writes";
import type { CompanyIdentity, InvestmentPorts, SaveAnalysisInput, SaveReportInput } from "../../core/services/ports";
import { createInvestmentCore, type ReadOptions } from "../../core/services/investment-os";
import { isReportInput } from "../../core/analysis/report";
import { SCHEMA_VERSION, isIsoDateOrDateTime, type Provenance, type ServiceResult, type Diagnostic } from "../../core/contracts/common";
import type { AnalysisPreview } from "../../core/contracts/analysis";
import type { CurrentAnalysisFamily, CurrentSelectionInput } from "../../core/analysis/current-selection";
import type { CompanyPreview, Portfolio, Quote } from "../../core/contracts/investment";
import { getCompanyDetail, getLivePortfolio, getResearchDocument, listResearchDocuments, readCurrentAnalysisContext, propertyValue, type CompanyDetail, type CompanyDocument, type LivePortfolio, type ResearchDocument, readPosition } from "./investment-data";
import { companyPreview } from "../../app/lib/company-preview";
import { normalizeAnalysisDocument } from "../../app/lib/document-presentation";
import { canonicalAnalysisContent, parseNotionText } from "../../app/lib/notion-renderer";
import { normalizeNotionPageId } from "./sync";
import { getQuotes, instruments, type QuoteView } from "../../app/lib/quotes";

export const analysisOf = (document: CompanyDocument, normalized = document.normalizedAnalysis ?? normalizeAnalysisDocument(document)) => {
  const analysis = normalized.analysis;
  const canonical = { ...analysis };
  canonical.header = { ...canonical.header };
  canonical.header.id = normalizeNotionPageId(analysis.header.id);
  canonical.header.companyIds = analysis.header.companyIds.map(normalizeNotionPageId);
  return canonical;
};

/** One projection of the existing normalizer; never exposes bodies in a preview. */
export function analysisPreview(document: CompanyDocument): AnalysisPreview {
  const normalized = document.normalizedAnalysis ?? normalizeAnalysisDocument(document);
  const analysis = analysisOf(document, normalized);
  return {
    ...analysis.header,
    summary: analysis.summary, handoffSummary: document.handoffSummary,
    previewSummaryItems: document.previewSummaryItems ?? normalized.view.summaryItems,
    score: analysis.kind === "business" || analysis.kind === "valuation" ? analysis.score : null,
    verdict: analysis.verdict, confidence: analysis.confidence,
    projectionStatus: analysis.projection.status, diagnostics: analysis.diagnostics,
  };
}

export function canonicalCompany(company: CompanyDetail, provenanceKind: Provenance["kind"] = "notion"): CompanyPreview {
  const { analyses, earnings, decisions, portfolioDocuments, archives, researchReferences, ...identity } = company;
  return {
    ...identity, id: normalizeNotionPageId(company.id), schemaVersion: SCHEMA_VERSION,
    lastAnalysis: company.lastAnalysis && isIsoDateOrDateTime(company.lastAnalysis) ? company.lastAnalysis : null,
    // Companies has no source revision in the existing read model. Do not invent one.
    provenance: { kind: provenanceKind, sourceId: normalizeNotionPageId(company.id), revision: null, capturedAt: null },
    researchReferences: researchReferences.map(reference => ({
      ...reference, id: normalizeNotionPageId(reference.id), schemaVersion: SCHEMA_VERSION,
      provenance: { kind: provenanceKind, sourceId: normalizeNotionPageId(reference.id), revision: reference.lastEditedTime, capturedAt: reference.lastEditedTime },
    })),
    analyses: analyses.map(analysisPreview), earnings: earnings.map(analysisPreview),
    decisions: decisions.map(analysisPreview), portfolioDocuments: portfolioDocuments.map(analysisPreview), archives: archives.map(analysisPreview),
  };
}

export function canonicalPortfolio(portfolio: LivePortfolio, positionProvenance: Provenance["kind"] = "notion"): Portfolio {
  return {
    ...portfolio, schemaVersion: SCHEMA_VERSION,
    provenance: { kind: "derived", sourceId: null, revision: null, capturedAt: portfolio.generatedAt },
    positions: portfolio.positions.map(position => ({
      ...position, id: normalizeNotionPageId(position.id), companyIds: position.companyIds.map(normalizeNotionPageId),
      schemaVersion: SCHEMA_VERSION, lifecycle: "open",
      provenance: { kind: positionProvenance, sourceId: normalizeNotionPageId(position.id), revision: null, capturedAt: null },
    })),
  };
}

export function canonicalQuote(quote: QuoteView): Quote {
  return { ...quote, nativeCurrency: quote.nativeCurrency || null, schemaVersion: SCHEMA_VERSION,
    provenance: { kind: "derived", sourceId: quote.assetId, revision: quote.marketTime, capturedAt: quote.fetchedAt } };
}

/** Core errors cross HTTP as categories, never raw storage messages. */
function requireResult<T>(result: ServiceResult<T>): T {
  if (result.status === "ok") return result.data;
  throw Object.assign(new Error(result.error.message), { code: result.error.code, stage: result.error.code === "normalization" ? "normalization" : "read", retryable: result.error.retryable });
}

/** Assemble the Core once at the storage boundary; IDs passed through Core stay canonical and opaque. */
/** Report Markdown → canonical blocks with the same normalizer the app reader uses. */
export const reportContentRenderer = (markdown: string) => canonicalAnalysisContent("report", parseNotionText(markdown));

function notionPorts(db: D1Database, writes?: NotionWriteOptions): InvestmentPorts {
  const currentCandidates = new Map<string, CurrentSelectionInput["candidates"][number]>();
  return {
    readCompanyIdentities: async (): Promise<CompanyIdentity[]> => {
      const rows = (await db.prepare("SELECT page_id,title,properties_json FROM notion_documents WHERE source_key='companies'").all<{ page_id: string; title: string; properties_json: string }>()).results ?? [];
      return rows.map(row => {
        const properties = JSON.parse(row.properties_json) as Record<string, unknown>;
        const aliasValue = propertyValue(properties, "Aliases") ?? propertyValue(properties, "Alias");
        const ticker = String(propertyValue(properties, "Ticker") ?? "");
        const exchange = String(propertyValue(properties, "Exchange") ?? "") || null;
        // Reuse the runtime quote catalogue; never infer a Company ID from it.
        const assets = Object.values(instruments).filter(instrument => {
          const [symbol, market] = instrument.googleSymbol?.split(":") ?? [];
          return (instrument.yahooSymbol.toUpperCase() === ticker.toUpperCase() || symbol?.toUpperCase() === ticker.toUpperCase()) &&
            (!exchange || market?.toUpperCase() === exchange.toUpperCase());
        });
        return {
          companyId: normalizeNotionPageId(row.page_id),
          canonicalName: String(propertyValue(properties, "Company") || row.title),
          ticker, exchange,
          assetId: assets.length === 1 ? assets[0].id : null,
          aliases: Array.isArray(aliasValue) ? aliasValue.map(String) : typeof aliasValue === "string" ? aliasValue.split(/[,;\n]/).map(value => value.trim()).filter(Boolean) : [],
        };
      });
    },
    readPosition: (id, options) => readPosition(db, id, options),
    ...(writes ? { writeAnalysis: createNotionAnalysisWriter(db, writes), renderReportContent: reportContentRenderer } : {}),
    readCurrentContext: async (companyId, family) => {
      const context = await readCurrentAnalysisContext(db, companyId, family);
      for (const candidate of context.candidates) currentCandidates.set(candidate.id, candidate);
      return context;
    },
    readAnalysis: async id => {
      const document = await getResearchDocument(db, id);
      if (!document) return null;
      const analysis = analysisOf(document);
      const candidate = currentCandidates.get(id);
      if (candidate) {
        analysis.header.companyIds = candidate.companyIds.slice();
        analysis.header.sourceFreshness = candidate.sourceFreshness;
        analysis.header.archived = candidate.archived;
      }
      return analysis;
    },
    readCompany: async id => {
      const company = await getCompanyDetail(db, id);
      return company ? canonicalCompany(company) : null;
    },
    readPortfolio: async options => canonicalPortfolio(await getLivePortfolio(db, options?.force ?? false, options?.cacheOnly ?? false)),
    readQuote: async (assetId, options) => {
      const quotes = await getQuotes([assetId], options?.force ?? false, db, options?.cacheOnly ?? false);
      const quote = quotes.find(item => item.assetId === assetId);
      if (!quote) throw Object.assign(new Error("Cours introuvable."), { code: "not_found" });
      return canonicalQuote(quote);
    },
  };
}

export function createInvestmentService(db: D1Database, writes?: NotionWriteOptions) {
  const service=createInvestmentCore(notionPorts(db, writes));
  if(!writes)return service;
  return {...service,async saveAnalysis(input:SaveAnalysisInput|SaveReportInput){
    const diagnostics:Diagnostic[]=[];
    const result=await createInvestmentCore(notionPorts(db,{...writes,onDiagnostic:diagnostic=>{diagnostics.push(diagnostic);writes.onDiagnostic?.(diagnostic);}})).saveAnalysis(input);
    return {...result,metadata:{...result.metadata,diagnostics:[...result.metadata.diagnostics,...diagnostics]}};
  }};
}

/** Request-local bridge: legacy JSON stays at the HTTP boundary, domain validation is mandatory. */
export function createInvestmentAdapter(db: D1Database, writes?:NotionWriteOptions) {
  return {
    getPosition(id:string,options?:ReadOptions){
      return createInvestmentService(db,writes).getPosition(typeof id==="string"?normalizeNotionPageId(id):id,options);
    },
    saveAnalysis(request:SaveAnalysisInput|SaveReportInput){
      if(isReportInput(request)){
        return createInvestmentService(db,writes).saveAnalysis(typeof request.companyId==="string"?{...request,companyId:normalizeNotionPageId(request.companyId)}:request);
      }
      let input=request as SaveAnalysisInput;
      if(input?.analysis?.header && typeof input.analysis.header.id==="string" && Array.isArray(input.companyIds) && input.companyIds.every(id=>typeof id==="string") && Array.isArray(input.analysis.header.companyIds) && input.analysis.header.companyIds.every(id=>typeof id==="string")){
        const analysis={...input.analysis};
        analysis.header={...analysis.header,id:normalizeNotionPageId(analysis.header.id),companyIds:analysis.header.companyIds.map(normalizeNotionPageId)};
        input={...input,companyIds:input.companyIds.map(normalizeNotionPageId),analysis};
      }
      return createInvestmentService(db,writes).saveAnalysis(input);
    },
    /** Canonical policy available for parity checks; legacy UI selection remains unchanged. */
    getCurrentAnalysis(companyId: string, family: CurrentAnalysisFamily) {
      return createInvestmentService(db, writes).getCurrentAnalysis(normalizeNotionPageId(companyId), family);
    },
    async getCompany(id: string): Promise<CompanyDetail | null> {
      let transport: CompanyDetail | null = null;
      const core = createInvestmentCore({ readCompany: async companyId => {
        const full = await getCompanyDetail(db, companyId);
        if (!full) return null;
        const canonical = canonicalCompany(full);
        transport = companyPreview(full);
        return canonical;
      } });
      requireResult(await core.getCompany(normalizeNotionPageId(id)));
      return transport;
    },
    async getPortfolio(options: ReadOptions = {}): Promise<LivePortfolio> {
      let transport: LivePortfolio | undefined;
      const core = createInvestmentCore({ readPortfolio: async requested => {
        transport = await getLivePortfolio(db, requested?.force ?? false, requested?.cacheOnly ?? false);
        return canonicalPortfolio(transport);
      } });
      requireResult(await core.getPortfolio(options));
      return transport!;
    },
    async getAnalysisById(id: string): Promise<ResearchDocument | null> {
      let transport: ResearchDocument | null = null;
      const core = createInvestmentCore({ readAnalysis: async analysisId => {
        transport = await getResearchDocument(db, analysisId);
        return transport ? analysisOf(transport) : null;
      } });
      requireResult(await core.getAnalysisById(normalizeNotionPageId(id)));
      return transport;
    },
    async listAnalysesForIntegrity(): Promise<ResearchDocument[]> {
      let transport: ResearchDocument[] = [];
      const core = createInvestmentCore({ listAnalyses: async () => {
        transport = await listResearchDocuments(db, true);
        return transport.map(analysisPreview);
      } });
      requireResult(await core.listAnalyses());
      return transport;
    },
    async getQuotes(ids: string[], options: ReadOptions = {}): Promise<QuoteView[]> {
      const transport = await getQuotes(ids, options.force ?? false, db, options.cacheOnly ?? false);
      const core = createInvestmentCore({ readQuote: async assetId => {
        const quote = transport.find(item => item.assetId === assetId);
        if (!quote) throw Object.assign(new Error("Cours introuvable."), { code: "not_found" });
        return canonicalQuote(quote);
      } });
      for (const id of ids) requireResult(await core.getQuote(id, options));
      return transport;
    },
  };
}

/** Existing HTTP consumers keep their transport payloads and import name. */
export const createInvestmentReadAdapter = createInvestmentAdapter;
