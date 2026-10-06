import type { SaveAnalysisInput, SaveReportInput } from "../../core/services/ports";
import { isReportInput } from "../../core/analysis/report";

type SiteCampaign = { companyId: string; families: readonly string[] };

/** Fixed, source-owned authorization for the bounded Lot 13 Sites campaign. */
export const SITE_CAMPAIGN_EXPIRES_AT = "2026-10-06T14:00:00Z";
export const SITE_WRITE_CAMPAIGNS: Readonly<Record<string, SiteCampaign>> = Object.freeze({
  "FV-SU-20261006-LOT13-E2E": Object.freeze({ companyId: "3b337ea7af3581ca97c4f048f9d52b1c", families: Object.freeze(["business", "valuation"]) }),
  "ER-MU-20261006-LOT13-E2E": Object.freeze({ companyId: "3b537ea7af3581bd9d9bd65dcfe03d97", families: Object.freeze(["earnings"]) }),
  "FA-GOOGL-20261006-LOT13-E2E": Object.freeze({ companyId: "3b337ea7af35819e8bd8f12ea7fb5dc4", families: Object.freeze(["business", "valuation", "short", "portfolio", "cio_memo"]) }),
});

const compactId = (value: string) => value.trim().toLowerCase().replaceAll("-", "");

/** Enforce the campaign envelope before any Core method can be invoked. */
export function isAuthorizedSiteCampaignWrite(request: SaveAnalysisInput | SaveReportInput, allowedRunIds: readonly string[], now = Date.now()): boolean {
  if (!Number.isFinite(Date.parse(SITE_CAMPAIGN_EXPIRES_AT)) || now >= Date.parse(SITE_CAMPAIGN_EXPIRES_AT)) return false;
  const campaign = typeof request?.runId === "string" && Object.hasOwn(SITE_WRITE_CAMPAIGNS, request.runId) ? SITE_WRITE_CAMPAIGNS[request.runId] : undefined;
  if (!campaign || !allowedRunIds.includes(request.runId)) return false;
  // Report form: same envelope (Draft only, creation only, one exact company, allowed family).
  if (isReportInput(request)) return request.status === "Draft" && typeof request.companyId === "string" && compactId(request.companyId) === compactId(campaign.companyId) && campaign.families.includes(request.kind);
  const input = request;
  if (!input.analysis || input.analysis.header.status !== "Draft" || input.expectedRevision !== null) return false;
  const companyId = compactId(campaign.companyId);
  const companyIds = input.companyIds.map(compactId);
  const headerCompanyIds = input.analysis.header.companyIds.map(compactId);
  if (companyIds.length !== 1 || companyIds[0] !== companyId || headerCompanyIds.length !== 1 || headerCompanyIds[0] !== companyId) return false;
  return campaign.families.includes(input.analysis.kind) && input.analysis.header.family === input.analysis.kind;
}
