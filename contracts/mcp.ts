/** Canonical MCP application contract. Types only: no server, dispatch or domain policy. */
import type { Analysis } from "../core/contracts/analysis.ts";
import type { CompanyPreview, Portfolio, Position, Quote } from "../core/contracts/investment.ts";
import type { Diagnostic, ServiceResult } from "../core/contracts/common.ts";
import type { CurrentAnalysisFamily } from "../core/analysis/current-selection.ts";
import type { CompanyCreation, CompanyResolution, CreateCompanyInput, ReadOptions, SaveAnalysisInput, SaveAnalysisReceipt, SaveReportInput } from "../core/services/ports.ts";

export const MCP_CONTRACT_VERSION = "1.0.0" as const;
export type McpScope = "personal" | "demo";
type Request = { contractVersion: typeof MCP_CONTRACT_VERSION; scope: McpScope };
export type McpInputs = {
  resolve_company: Request & { query: string; market?: string };
  get_company: Request & { id: string };
  get_portfolio: Request & { options?: ReadOptions };
  get_position: Request & { id: string; options?: ReadOptions };
  get_current_analysis: Request & { companyId: string; family: CurrentAnalysisFamily };
  get_analysis_by_id: Request & { id: string };
  /** `input` accepts the 1.1 report form; the 1.0 object form stays accepted for one release, unpublished. */
  save_analysis: Request & { input: SaveReportInput | SaveAnalysisInput };
  get_quote: Request & { assetId: string; options?: ReadOptions };
  create_company: Request & { input: CreateCompanyInput };
};
export type McpTransportErrorCode = "invalid_input" | "unsupported_version" | "unauthorized" | "forbidden" |
  "confirmation_required" | "limit_exceeded" | "timeout" | "network" | "rate_limit";
export type McpOutput<T> =
  | { contractVersion: typeof MCP_CONTRACT_VERSION; scope: McpScope; status: "completed"; result: ServiceResult<T> }
  | { contractVersion: typeof MCP_CONTRACT_VERSION; scope: McpScope | null; status: "rejected";
      error: { code: McpTransportErrorCode; message: string; retryable: boolean; outcome: "not_started" | "unknown" };
      diagnostics: Diagnostic[] };
export type McpOutputs = {
  resolve_company: McpOutput<CompanyResolution>;
  get_company: McpOutput<CompanyPreview | null>;
  get_portfolio: McpOutput<Portfolio>;
  get_position: McpOutput<Position | null>;
  get_current_analysis: McpOutput<Analysis | null>;
  get_analysis_by_id: McpOutput<Analysis | null>;
  save_analysis: McpOutput<SaveAnalysisReceipt>;
  get_quote: McpOutput<Quote>;
  create_company: McpOutput<CompanyCreation>;
};

/** The positional arguments below are an exact specification, not an executable dispatcher. */
export const MCP_TOOLS = {
  resolve_company: { title: "Résoudre une entreprise", description: "Résoudre un nom, ticker ou alias connu vers des identifiants Company canoniques sans choisir en cas d'ambiguïté.", operation: "resolveCompany", arguments: ["query", "market"], access: "READ" },
  get_company: { title: "Lire une entreprise", description: "Lire l'identité, les aperçus et les archives d'une entreprise.", operation: "getCompany", arguments: ["id"], access: "READ" },
  get_portfolio: { title: "Lire le portefeuille", description: "Lire le portefeuille et ses agrégats calculés par le Core.", operation: "getPortfolio", arguments: ["options"], access: "READ" },
  get_position: { title: "Lire une position", description: "Lire une position ouverte ou fermée par son identifiant.", operation: "getPosition", arguments: ["id", "options"], access: "READ" },
  get_current_analysis: { title: "Lire l'analyse Current", description: "Lire l'analyse Current sélectionnée par le Core pour une entreprise et une famille.", operation: "getCurrentAnalysis", arguments: ["companyId", "family"], access: "READ" },
  get_analysis_by_id: { title: "Lire une analyse par ID", description: "Lire une analyse par ID, y compris une version historique ou archivée.", operation: "getAnalysisById", arguments: ["id"], access: "READ" },
  save_analysis: { title: "Enregistrer une analyse", description: "Enregistrer le rapport d'un module (format \"report\" : rapport Markdown + champs du handoff) ; le Core construit l'analyse et renvoie le receipt de persistance sans altération. Un seul appel par intention, jamais de retry.", operation: "saveAnalysis", arguments: ["input"], access: "WRITE" },
  get_quote: { title: "Lire une cotation", description: "Lire une cotation et ses indications de fraîcheur, source et disponibilité.", operation: "getQuote", arguments: ["assetId", "options"], access: "READ" },
  create_company: { title: "Créer une entreprise", description: "Créer une fiche Company minimale pour un titre absent de la base. ISIN obligatoire. Le serveur revérifie les doublons (ISIN, ticker, nom) dans le cache et dans Notion en direct : status \"existing\" signifie que rien n'a été créé et renvoie la fiche connue. À n'appeler qu'après un resolve_company not_found sur le nom, le ticker et l'ISIN.", operation: "createCompany", arguments: ["input"], access: "WRITE" },
} as const;
export const MCP_LIMITS = { requestBytes: 2_097_152, responseBytes: 4_194_304, readTimeoutMs: 30_000, writeTimeoutMs: 30_000, readAttempts: 2, writeAttempts: 1, readsPerWindow: 120, readWindowMs: 60_000, writesPerWindow: 40, writeWindowMs: 86_400_000 } as const;
