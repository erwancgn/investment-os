import type { CompanyDetail, CompanyDocument } from "./investment-data";
import { documentPresentation } from "./document-presentation";
import { parseNotionDocument } from "./notion-renderer";

// Derive the exact existing TL;DR before removing report bodies from list payloads.
// Full text and blocks remain available through /api/analyses/:id.
export function companyPreview(company: CompanyDetail): CompanyDetail {
  const seen = new Map<string, CompanyDocument>();
  const compact = (document: CompanyDocument): CompanyDocument => {
    const existing = seen.get(document.id);
    if (existing) return existing;
    const previewSummaryItems = documentPresentation(
      parseNotionDocument(document.plainText, document.title, document.notionBlocks),
      document.summary,
      { category: document.category, handoffSummary: document.handoffSummary },
    ).summaryItems;
    const result = { ...document, plainText: "", notionBlocks: undefined, previewSummaryItems };
    seen.set(document.id, result);
    return result;
  };
  return { ...company, analyses: company.analyses.map(compact), earnings: company.earnings.map(compact), decisions: company.decisions.map(compact), portfolioDocuments: company.portfolioDocuments.map(compact), archives: company.archives?.map(compact) };
}
