import { createInvestmentCore, type ReadOptions } from "../../core/services/investment-os";
import { SCHEMA_VERSION, isIsoDateOrDateTime, type Provenance, type ServiceResult } from "../../core/contracts/common";
import type { AnalysisPreview } from "../../core/contracts/analysis";
import type { CurrentAnalysisFamily, CurrentSelectionInput } from "../../core/analysis/current-selection";
import type { CompanyPreview, Portfolio, Quote } from "../../core/contracts/investment";
import { getCompanyDetail, getLivePortfolio, getResearchDocument, listResearchDocuments, readCurrentAnalysisContext, type CompanyDetail, type CompanyDocument, type LivePortfolio, type ResearchDocument } from "../../app/lib/investment-data";
import { companyPreview } from "../../app/lib/company-preview";
import { normalizeAnalysisDocument } from "../../app/lib/document-presentation";
import { normalizeNotionPageId } from "../../app/lib/notion-sync";
import { getQuotes, type QuoteView } from "../../app/lib/quotes";

const provenance = (sourceId: string | null, revision: string | null, capturedAt: string | null): Provenance => ({ kind: "notion", sourceId, revision, capturedAt });
const analysisOf = (document: CompanyDocument, normalized = document.normalizedAnalysis ?? normalizeAnalysisDocument(document)) => {
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

export function canonicalCompany(company: CompanyDetail): CompanyPreview {
  const { analyses, earnings, decisions, portfolioDocuments, archives, researchReferences, ...identity } = company;
  return {
    ...identity, id: normalizeNotionPageId(company.id), schemaVersion: SCHEMA_VERSION,
    lastAnalysis: company.lastAnalysis && isIsoDateOrDateTime(company.lastAnalysis) ? company.lastAnalysis : null,
    // Companies has no source revision in the existing read model. Do not invent one.
    provenance: provenance(normalizeNotionPageId(company.id), null, null),
    researchReferences: researchReferences.map(reference => ({
      ...reference, id: normalizeNotionPageId(reference.id), schemaVersion: SCHEMA_VERSION,
      provenance: provenance(normalizeNotionPageId(reference.id), reference.lastEditedTime, reference.lastEditedTime),
    })),
    analyses: analyses.map(analysisPreview), earnings: earnings.map(analysisPreview),
    decisions: decisions.map(analysisPreview), portfolioDocuments: portfolioDocuments.map(analysisPreview), archives: archives.map(analysisPreview),
  };
}

export function canonicalPortfolio(portfolio: LivePortfolio): Portfolio {
  return {
    ...portfolio, schemaVersion: SCHEMA_VERSION,
    provenance: { kind: "derived", sourceId: null, revision: null, capturedAt: portfolio.generatedAt },
    positions: portfolio.positions.map(position => ({
      ...position, id: normalizeNotionPageId(position.id), companyIds: position.companyIds.map(normalizeNotionPageId),
      schemaVersion: SCHEMA_VERSION, lifecycle: "open",
      provenance: provenance(normalizeNotionPageId(position.id), null, null),
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

/** Request-local bridge: legacy JSON stays at the HTTP boundary, domain validation is mandatory. */
export function createInvestmentReadAdapter(db: D1Database) {
  return {
    /** Canonical policy available for parity checks; legacy UI selection remains unchanged. */
    async getCurrentAnalysis(companyId: string, family: CurrentAnalysisFamily) {
      let context: CurrentSelectionInput | undefined;
      const core = createInvestmentCore({
        readCurrentContext: async (id, requestedFamily) => {
          context = await readCurrentAnalysisContext(db, id, requestedFamily);
          return context;
        },
        readAnalysis: async id => {
          const document = await getResearchDocument(db, id);
          if (!document) return null;
          const analysis = analysisOf(document);
          const candidate = context?.candidates.find(item => item.id === id);
          // Ownership/freshness come from the same mapped source headers used by selection.
          if (candidate) {
            analysis.header.companyIds = candidate.companyIds.slice();
            analysis.header.sourceFreshness = candidate.sourceFreshness;
            analysis.header.archived = candidate.archived;
          }
          return analysis;
        },
      });
      return core.getCurrentAnalysis(normalizeNotionPageId(companyId), family);
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
