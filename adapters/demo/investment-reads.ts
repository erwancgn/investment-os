import { createInvestmentCore } from "../../core/services/investment-os";
import type { InvestmentPorts } from "../../core/services/ports";
import type { Analysis } from "../../core/contracts/analysis";
import type { CurrentAnalysisFamily, CurrentSelectionInput } from "../../core/analysis/current-selection";
import { getDemoCompanyDetail, getDemoLivePortfolio, getDemoResearchDocument, demoDataIds } from "../../app/lib/demo-data";
import { analysisOf, canonicalCompany, canonicalPortfolio, canonicalQuote } from "../notion/investment-reads";
import type { CompanyDocument, LivePortfolio } from "../notion/investment-data";

function documents(): CompanyDocument[] {
  return demoDataIds.analyses.flatMap(id => {
    const result = getDemoResearchDocument(id);
    return result ? [result.document] : [];
  });
}

function familyForKind(kind: string): CurrentAnalysisFamily | null {
  if (kind === "business" || kind === "valuation" || kind === "short" || kind === "portfolio") return kind;
  if (kind === "memo") return "cio_memo";
  return null;
}

function ownerFor(id: string): string | null {
  for (const companyId of demoDataIds.companies) {
    const detail = getDemoCompanyDetail(companyId)?.company;
    if (detail && [...detail.analyses, ...detail.earnings, ...detail.decisions, ...detail.portfolioDocuments].some(doc => doc.id === id)) return companyId;
  }
  return null;
}

function withDemoOwner(document: CompanyDocument, companyIds?: string[]): Analysis {
  const analysis = analysisOf(document);
  if (companyIds) analysis.header.companyIds = [...companyIds];
  else {
    const owner = ownerFor(document.id);
    analysis.header.companyIds = owner ? [owner] : [];
  }
  if (analysis.header.sourceUrl === "#") analysis.header.sourceUrl = null;
  return analysis;
}

async function readCurrentContext(companyId: string, family: CurrentAnalysisFamily): Promise<CurrentSelectionInput> {
  const detail = getDemoCompanyDetail(companyId)?.company;
  if (!detail) throw Object.assign(new Error("Entreprise introuvable."), { code: "not_found" });
  const allDocuments = documents();
  const currentIds = detail.researchReferences.flatMap(reference => familyForKind(reference.kind) === family ? [reference.id] : []);
  const candidates = allDocuments.flatMap(document => {
    const owner = ownerFor(document.id);
    const analysis = withDemoOwner(document, owner ? [owner] : []);
    const header = analysis.header;
    if (header.family === "generic" || header.family === "unknown") return [];
    return [{
      id: header.id, family: header.family, sourceKind: header.sourceKind, agent: header.agent, status: header.status,
      date: header.date, lastEditedTime: header.lastEditedTime, companyIds: header.companyIds,
      sourceFreshness: header.sourceFreshness, archived: header.archived,
    }];
  });
  return { companyId, family, explicitCurrentIds: currentIds, candidates };
}

function demoQuote(assetId: string, portfolio: LivePortfolio) {
  const position = portfolio.positions.find(item => item.targetId === assetId || item.id === assetId);
  if (!position) throw Object.assign(new Error("Cours introuvable."), { code: "not_found" });
  const quote = canonicalQuote({
    assetId, name: position.name, nativePrice: position.nativePrice, nativeCurrency: position.nativeCurrency,
    eurPrice: position.eurPrice, fxRate: position.fxRate, fxMarketTime: position.fxMarketTime,
    previousClose: null, changePercent: position.changePercent, marketTime: portfolio.generatedAt,
    fetchedAt: portfolio.generatedAt, source: position.quoteSource, freshness: "closed", isFallback: false,
    warnings: [...position.quoteWarnings],
  });
  return quote;
}

function demoPorts(): InvestmentPorts {
  const portfolio = getDemoLivePortfolio();
  return {
    readCompany: async id => {
      const detail = getDemoCompanyDetail(id)?.company;
      return detail ? canonicalCompany(detail, "legacy") : null;
    },
    readPortfolio: async () => canonicalPortfolio(portfolio, "legacy"),
    readPosition: async (id) => {
      const mapped = canonicalPortfolio(portfolio, "legacy");
      return mapped.positions.find(position => position.id === id) ?? null;
    },
    readAnalysis: async id => {
      const result = getDemoResearchDocument(id);
      return result ? withDemoOwner(result.document) : null;
    },
    readCurrentContext,
    readQuote: async assetId => demoQuote(assetId, portfolio),
  };
}

/** Core service backed only by the deterministic demo snapshot. */
export function createDemoInvestmentService() {
  return createInvestmentCore(demoPorts());
}
