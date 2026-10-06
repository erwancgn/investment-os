import type { Analysis, AnalysisContent, AnalysisFamily, AnalysisPreview } from "../contracts/analysis.ts";
import type { CompanyPreview, Portfolio, Position, Quote } from "../contracts/investment.ts";
import type { CurrentAnalysisFamily, CurrentSelectionInput } from "../analysis/current-selection.ts";

export type ReadOptions = { force?: boolean; cacheOnly?: boolean };
export type ListAnalysesParams = {
  companyId?: string;
  family?: AnalysisFamily;
  archived?: boolean;
  status?: string;
};

export type SaveAnalysisInput = {
  analysis: Analysis;
  runId: string;
  expectedRevision: string | null;
  companyIds: string[];
};

/** Families a skill can persist through the report form (Decisions are not writable). */
export type ReportKind = "business" | "valuation" | "short" | "portfolio" | "cio_memo" | "earnings";
export type ReportRefreshStatus = "not-needed" | "monitor" | "recommended" | "required";
/** Options configured on the Notion Earnings "Guidance vs Consensus" select. */
export type ReportGuidanceVsConsensus = "Above" | "Inline" | "Below" | "Not Available";
export type ReportEarnings = {
  fiscalPeriod: string | null;
  guidance: string | null;
  guidanceVsConsensus: ReportGuidanceVsConsensus | null;
  refreshes: { business: ReportRefreshStatus | null; valuation: ReportRefreshStatus | null; short: ReportRefreshStatus | null; portfolio: ReportRefreshStatus | null; memo: ReportRefreshStatus | null };
};
/** Contract 1.1 write form: the skill sends its report and handoff fields; the Core builds the Analysis. */
export type SaveReportInput = {
  format: "report";
  runId: string;
  kind: ReportKind;
  companyId: string;
  title: string;
  date: string;
  status: "Draft" | "Validated";
  reportMarkdown: string;
  summary: string | null;
  verdict: string | null;
  confidence: "High" | "Medium" | "Low" | null;
  score?: number | null;
  handoffSummary?: string | null;
  earnings?: ReportEarnings;
};

export type SaveAnalysisReceipt = {
  schemaVersion: "1.0.0";
  status: "persisted" | "promotion_pending" | "verified" | "partial";
  analysisId: string;
  runId: string;
  revision: string | null;
  persisted: boolean;
  promoted: boolean;
  verified: boolean;
  diagnostics: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
};

export type CompanyIdentity = {
  companyId: string;
  canonicalName: string;
  ticker: string;
  exchange: string | null;
  assetId: string | null;
  aliases: string[];
  /** ISO 6166 identifier when the source holds one. */
  isin?: string | null;
};
export type CompanyCandidate = { companyId: string; canonicalName: string; ticker: string; exchange: string | null; assetId: string | null; isin: string | null };
/** `resolved`: exactly one exact match. `ambiguous`: several, a market mismatch or a partial name — confirm, never guess. */
export type CompanyResolution = {
  status: "resolved" | "ambiguous" | "not_found";
  candidates: CompanyCandidate[];
};

/** create_company input: ISIN is mandatory, it is the only identifier unique to a security. */
export type CreateCompanyInput = { name: string; ticker: string; exchange: string | null; isin: string; currency: string | null; country: string | null };
/** `existing`: the company (or a conflicting one) is already known; nothing was written. */
export type CompanyCreation = { status: "created" | "existing"; candidates: CompanyCandidate[] };

/** Domain-only ports. Source IDs, storage, and transport details belong in adapters. */
export type InvestmentPorts = {
  readCompanyIdentities?: () => Promise<CompanyIdentity[]>;
  /** Re-checks duplicates against the live source before writing; never creates a second page for a known ISIN/ticker/name. */
  createCompany?: (input: CreateCompanyInput) => Promise<CompanyCreation>;
  readCompany?: (id: string) => Promise<CompanyPreview | null>;
  readPortfolio?: (options?: ReadOptions) => Promise<Portfolio>;
  readPosition?: (id: string, options?: ReadOptions) => Promise<Position | null>;
  readAnalysis?: (id: string) => Promise<Analysis | null>;
  listAnalyses?: (params?: ListAnalysesParams) => Promise<AnalysisPreview[]>;
  readCurrentContext?: (companyId: string, family: CurrentAnalysisFamily) => Promise<CurrentSelectionInput>;
  readQuote?: (assetId: string, options?: ReadOptions) => Promise<Quote>;
  writeAnalysis?: (input: SaveAnalysisInput) => Promise<SaveAnalysisReceipt>;
  /** Pure Markdown → canonical blocks, supplied by the adapter's existing reader normalizer. */
  renderReportContent?: (markdown: string) => AnalysisContent;
};
