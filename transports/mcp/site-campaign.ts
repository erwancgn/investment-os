import type { SaveAnalysisInput } from "../../core/services/ports";

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
export function isAuthorizedSiteCampaignWrite(input: SaveAnalysisInput, allowedRunIds: readonly string[], now = Date.now()): boolean {
  if (!Number.isFinite(Date.parse(SITE_CAMPAIGN_EXPIRES_AT)) || now >= Date.parse(SITE_CAMPAIGN_EXPIRES_AT)) return false;
  const campaign = SITE_WRITE_CAMPAIGNS[input.runId];
  if (!campaign || !allowedRunIds.includes(input.runId)) return false;
  if (!input.analysis || input.analysis.header.status !== "Draft" || input.expectedRevision !== null) return false;
  const companyId = compactId(campaign.companyId);
  const companyIds = input.companyIds.map(compactId);
  const headerCompanyIds = input.analysis.header.companyIds.map(compactId);
  if (companyIds.length !== 1 || companyIds[0] !== companyId || headerCompanyIds.length !== 1 || headerCompanyIds[0] !== companyId) return false;
  return campaign.families.includes(input.analysis.kind) && input.analysis.header.family === input.analysis.kind;
}
