/** Canonical MCP application contract. Types only: no server, dispatch or domain policy. */
import type { Analysis } from "../core/contracts/analysis.ts";
import type { CompanyPreview, Portfolio, Position, Quote } from "../core/contracts/investment.ts";
import type { Diagnostic, ServiceResult } from "../core/contracts/common.ts";
import type { CurrentAnalysisFamily } from "../core/analysis/current-selection.ts";
import type { ReadOptions, SaveAnalysisInput, SaveAnalysisReceipt } from "../core/services/ports.ts";

export const MCP_CONTRACT_VERSION = "1.0.0" as const;
export type McpScope = "personal" | "demo";
type Request = { contractVersion: typeof MCP_CONTRACT_VERSION; scope: McpScope };
export type McpInputs = {
  get_company: Request & { id: string };
  get_portfolio: Request & { options?: ReadOptions };
  get_position: Request & { id: string; options?: ReadOptions };
  get_current_analysis: Request & { companyId: string; family: CurrentAnalysisFamily };
  get_analysis_by_id: Request & { id: string };
  save_analysis: Request & { input: SaveAnalysisInput };
  get_quote: Request & { assetId: string; options?: ReadOptions };
};
export type McpTransportErrorCode = "invalid_input" | "unsupported_version" | "unauthorized" | "forbidden" |
  "confirmation_required" | "limit_exceeded" | "timeout" | "network" | "rate_limit";
export type McpOutput<T> =
  | { contractVersion: typeof MCP_CONTRACT_VERSION; scope: McpScope; status: "completed"; result: ServiceResult<T> }
  | { contractVersion: typeof MCP_CONTRACT_VERSION; scope: McpScope | null; status: "rejected";
      error: { code: McpTransportErrorCode; message: string; retryable: boolean; outcome: "not_started" | "unknown" };
      diagnostics: Diagnostic[] };
export type McpOutputs = {
  get_company: McpOutput<CompanyPreview | null>;
  get_portfolio: McpOutput<Portfolio>;
  get_position: McpOutput<Position | null>;
  get_current_analysis: McpOutput<Analysis | null>;
  get_analysis_by_id: McpOutput<Analysis | null>;
  save_analysis: McpOutput<SaveAnalysisReceipt>;
  get_quote: McpOutput<Quote>;
};

/** The positional arguments below are an exact specification, not an executable dispatcher. */
export const MCP_TOOLS = {
  get_company: { description: "Lire l'identité, les aperçus et les archives d'une entreprise.", operation: "getCompany", arguments: ["id"], access: "READ" },
  get_portfolio: { description: "Lire le portefeuille et ses agrégats calculés par le Core.", operation: "getPortfolio", arguments: ["options"], access: "READ" },
  get_position: { description: "Lire une position ouverte ou fermée par son identifiant.", operation: "getPosition", arguments: ["id", "options"], access: "READ" },
  get_current_analysis: { description: "Lire l'analyse Current sélectionnée par le Core pour une entreprise et une famille.", operation: "getCurrentAnalysis", arguments: ["companyId", "family"], access: "READ" },
  get_analysis_by_id: { description: "Lire une analyse par ID, y compris une version historique ou archivée.", operation: "getAnalysisById", arguments: ["id"], access: "READ" },
  save_analysis: { description: "Soumettre une analyse au Core et recevoir le receipt de persistance sans altération.", operation: "saveAnalysis", arguments: ["input"], access: "WRITE" },
  get_quote: { description: "Lire une cotation et ses indications de fraîcheur, source et disponibilité.", operation: "getQuote", arguments: ["assetId", "options"], access: "READ" },
} as const;
export const MCP_LIMITS = { requestBytes: 2_097_152, responseBytes: 4_194_304, readTimeoutMs: 30_000, writeTimeoutMs: 120_000, readAttempts: 2, writeAttempts: 1 } as const;
