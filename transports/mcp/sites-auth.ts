import type { McpCaller } from "./server";
export type SitesMcpEnv = { OWNER_EMAIL?: string; MCP_WRITE_ENABLED?: string; MCP_WRITE_DELEGATED?: string; MCP_WRITE_TEST_RUN_IDS?: string };
/** Only for Sites dispatch: it supplies verified identity; never mount this auth on a raw public Worker. */
export function authenticateSitesMcp(request: Request, env: SitesMcpEnv): McpCaller | null {
  const subject = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!subject || !email) return null;
  const owner = Boolean(env.OWNER_EMAIL?.trim() && email === env.OWNER_EMAIL.trim().toLowerCase());
  const allowedWriteRunIds = env.MCP_WRITE_TEST_RUN_IDS?.split(",").map(id => id.trim()).filter(Boolean) ?? [];
  const writeEnabled = owner && env.MCP_WRITE_ENABLED === "1" && env.MCP_WRITE_DELEGATED === "1" && allowedWriteRunIds.length > 0;
  return { subject, scopes: owner ? ["personal", "demo"] : ["demo"],
    permissions: writeEnabled ? ["investment:read", "investment:write"] : ["investment:read"],
    writeApproved: writeEnabled,
    allowedWriteRunIds };
}
