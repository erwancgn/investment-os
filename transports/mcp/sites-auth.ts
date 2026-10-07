import type { McpCaller } from "./server";
export type SitesMcpEnv = { OWNER_EMAIL?: string; MCP_WRITE_ENABLED?: string };
/** Source release decision for production WRITE (owner-only). `MCP_WRITE_ENABLED` is the hosted kill switch. */
const SITE_WRITE_RELEASE_APPROVED = true;
/** Only for Sites dispatch: it supplies verified identity; never mount this auth on a raw public Worker. */
export function authenticateSitesMcp(request: Request, env: SitesMcpEnv): McpCaller | null {
  const subject = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!subject || !email) return null;
  const owner = Boolean(env.OWNER_EMAIL?.trim() && email === env.OWNER_EMAIL.trim().toLowerCase());
  const writeEnabled = SITE_WRITE_RELEASE_APPROVED && owner && env.MCP_WRITE_ENABLED === "1";
  return { subject, scopes: owner ? ["personal", "demo"] : ["demo"],
    permissions: writeEnabled ? ["investment:read", "investment:write"] : ["investment:read"],
    writeApproved: writeEnabled };
}
