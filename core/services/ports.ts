import type { Analysis, AnalysisFamily, AnalysisPreview } from "../contracts/analysis.ts";
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

/** Domain-only ports. Source IDs, storage, and transport details belong in adapters. */
export type InvestmentPorts = {
  readCompany?: (id: string) => Promise<CompanyPreview | null>;
  readPortfolio?: (options?: ReadOptions) => Promise<Portfolio>;
  readPosition?: (id: string, options?: ReadOptions) => Promise<Position | null>;
  readAnalysis?: (id: string) => Promise<Analysis | null>;
  listAnalyses?: (params?: ListAnalysesParams) => Promise<AnalysisPreview[]>;
  readCurrentContext?: (companyId: string, family: CurrentAnalysisFamily) => Promise<CurrentSelectionInput>;
  readQuote?: (assetId: string, options?: ReadOptions) => Promise<Quote>;
  writeAnalysis?: (input: SaveAnalysisInput) => Promise<SaveAnalysisReceipt>;
};
