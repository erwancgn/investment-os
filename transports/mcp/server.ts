/** Stateless MCP transport. No storage, source mapping or domain decisions. */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import schemas from "../../contracts/mcp.v1.schema.json";
import { MCP_CONTRACT_VERSION, MCP_LIMITS, MCP_TOOLS, type McpInputs, type McpOutput, type McpScope, type McpTransportErrorCode } from "../../contracts/mcp";
import { isRecord } from "../../core/contracts/common";
import type { createInvestmentCore } from "../../core/services/investment-os";

type Core = ReturnType<typeof createInvestmentCore>;
type ToolName = keyof McpInputs;
/** Trusted runtime context, never parsed from tool arguments. */
export type McpCaller = { subject: string; scopes: McpScope[]; permissions: ("investment:read" | "investment:write")[]; writeApproved: boolean; allowedWriteRunIds?: string[] };
export type McpRuntime = {
  authenticate: (request: Request) => Promise<McpCaller | null> | McpCaller | null;
  service: (scope: McpScope, caller: McpCaller) => Core;
  waitUntil?: (promise: Promise<unknown>) => void;
};
const provider = new CfWorkerJsonSchemaValidator({ draft: "7" });
const schemaFor = (name: ToolName, field: "inputSchema" | "outputSchema") => {
  const ref = schemas.tools[name][field];
  const root = "$ref" in ref ? schemas.definitions[ref.$ref.split("/").at(-1) as keyof typeof schemas.definitions] : ref;
  return { type: "object" as const, ...root, definitions: schemas.definitions };
};
const validators = Object.fromEntries(Object.keys(MCP_TOOLS).map(name => [name, {
  input: provider.getValidator(schemaFor(name as ToolName, "inputSchema")),
  output: provider.getValidator(schemaFor(name as ToolName, "outputSchema")),
}])) as Record<ToolName, { input: ReturnType<typeof provider.getValidator>; output: ReturnType<typeof provider.getValidator> }>;
/** Hosted tool clients can discard nested local refs when presenting arguments to a model. */
function inlineInputSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(inlineInputSchema);
  if (!isRecord(value)) return value;
  if (typeof value.$ref === "string") {
    const definition = schemas.definitions[value.$ref.split("/").at(-1) as keyof typeof schemas.definitions];
    if (!definition) throw new Error("Unknown MCP schema reference");
    return inlineInputSchema(definition);
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "definitions").map(([key, item]) => [key, inlineInputSchema(item)]));
}
export const mcpToolCatalog: Tool[] = Object.entries(MCP_TOOLS).map(([name, spec]) => ({
  name, description: spec.description,
  inputSchema: inlineInputSchema(schemaFor(name as ToolName, "inputSchema")) as Tool["inputSchema"],
  outputSchema: schemaFor(name as ToolName, "outputSchema") as Tool["outputSchema"],
  annotations: { readOnlyHint: spec.access === "READ", destructiveHint: spec.access === "WRITE", idempotentHint: spec.access === "READ", openWorldHint: true },
}));
const messages: Record<McpTransportErrorCode, string> = {
  invalid_input: "Paramètres transport invalides.", unsupported_version: "Contrat supporté : 1.0.0.",
  unauthorized: "Authentification requise.", forbidden: "Accès refusé.", confirmation_required: "Délégation de mutation requise.",
  limit_exceeded: "Limite de taille dépassée.", timeout: "Délai transport dépassé.", network: "Transport indisponible.", rate_limit: "Opération déjà en cours.",
};
const diagnosticCodes: Record<McpTransportErrorCode, string> = { invalid_input: "input_schema", unsupported_version: "contract_version", unauthorized: "caller_auth", forbidden: "scope_permission", confirmation_required: "mutation_confirmation", limit_exceeded: "payload_limit", timeout: "transport_timeout", network: "transport_network", rate_limit: "transport_rate_limit" };
const rejected = (code: McpTransportErrorCode, scope: McpScope | null = null, outcome: "not_started" | "unknown" = "not_started"): McpOutput<never> => ({
  contractVersion: MCP_CONTRACT_VERSION, scope, status: "rejected",
  error: { code, message: messages[code], retryable: false, outcome }, diagnostics: [{ code: diagnosticCodes[code], message: messages[code], severity: "error" }],
});
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Call arguments come exclusively from the canonical manifest, in its declared order. */
function invoke(core: Core, name: ToolName, input: McpInputs[ToolName]) {
  const spec = MCP_TOOLS[name];
  const args = spec.arguments.map(key => (input as unknown as Record<string, unknown>)[key]);
  // Union of positional signatures; canonical mapping is tested against every real Core method.
  return (core[spec.operation] as (...args: unknown[]) => ReturnType<Core[typeof spec.operation]>).apply(core, args);
}

export function createMcpHandler(runtime: McpRuntime) {
  // Only live transport concurrency, not an idempotency journal/cache. Writer owns durable replay.
  const activeWrites = new Set<string>();
  async function call(name: ToolName, raw: unknown, caller: McpCaller, keepAlive?: McpRuntime["waitUntil"]): Promise<McpOutput<unknown>> {
    const scope = isRecord(raw) && (raw.scope === "personal" || raw.scope === "demo") ? raw.scope : null;
    const write = MCP_TOOLS[name].access === "WRITE";
    if (!scope) return rejected("invalid_input");
    if (!caller.scopes.includes(scope) || !caller.permissions.includes(write ? "investment:write" : "investment:read") || (write && scope === "demo")) return rejected("forbidden", scope);
    if (write && !caller.writeApproved) return rejected("confirmation_required", scope);
    if (!isRecord(raw) || raw.contractVersion !== MCP_CONTRACT_VERSION) return rejected("unsupported_version", scope);
    if (bytes(raw) > MCP_LIMITS.requestBytes) return rejected("limit_exceeded", scope);
    if (!validators[name].input(raw).valid) return rejected("invalid_input", scope);
    const input = raw as McpInputs[ToolName];
    if (write && caller.allowedWriteRunIds && !caller.allowedWriteRunIds.includes((input as McpInputs["save_analysis"]).input.runId)) return rejected("forbidden", scope);
    if (write && activeWrites.has(caller.subject)) return rejected("rate_limit", scope);
    if (write) activeWrites.add(caller.subject);
    const deadline = write ? MCP_LIMITS.writeTimeoutMs : MCP_LIMITS.readTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = false;
    let expired = false;
    const task = (async (): Promise<McpOutput<unknown>> => {
      try {
        const core = runtime.service(scope, caller);
        for (let attempt = 0; ; attempt++) {
          if (expired) return rejected("timeout", scope, started ? "unknown" : "not_started");
          started = true;
          const result = await invoke(core, name, input);
          const output: McpOutput<unknown> = { contractVersion: MCP_CONTRACT_VERSION, scope, status: "completed", result };
          if (!validators[name].output(output).valid) { const error = rejected("invalid_input", scope, "unknown"); if (error.status === "rejected") error.diagnostics[0] = { code: "output_schema", message: "Résultat transport invalide.", severity: "error", path: "output" }; return error; }
          // Retry only completed transient READ failures; the deadline never resets.
          if (!expired && !write && attempt + 1 < MCP_LIMITS.readAttempts && result.status === "error" && ["network", "timeout", "rate_limit"].includes(result.error.code)) { await sleep(250); continue; }
          if (bytes(output) > MCP_LIMITS.responseBytes) return rejected("limit_exceeded", scope, "unknown");
          return output;
        }
      } catch { return rejected("network", scope, started ? "unknown" : "not_started"); }
      finally { if (write) activeWrites.delete(caller.subject); }
    })();
    // A response deadline cannot cancel ports with no cancellation API. Keep the task alive and fenced.
    keepAlive?.(task.then(() => undefined));
    try {
      return await Promise.race([task, new Promise<McpOutput<never>>(resolve => {
        timer = setTimeout(() => { expired = true; resolve(rejected("timeout", scope, started ? "unknown" : "not_started")); }, deadline);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }
  return async (request: Request, keepAlive = runtime.waitUntil): Promise<Response> => {
    const headers = { "cache-control": "private, no-store" };
    if (request.headers.has("origin") || request.headers.get("sec-fetch-site") === "cross-site") return Response.json(rejected("forbidden"), { status: 403, headers });
    let caller: McpCaller | null;
    try { caller = await runtime.authenticate(request); } catch { caller = null; }
    if (!caller?.subject) return Response.json(rejected("unauthorized"), { status: 401, headers });
    // Stateless POST/JSON. No browser mutation, batch, session, replay or notification-side write.
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, allow: "POST" } });
    let body: unknown;
    try {
      const declared = Number(request.headers.get("content-length"));
      // Bounded JSON-RPC framing allowance; the tool arguments retain the exact 2 MiB ceiling.
      const wireLimit = MCP_LIMITS.requestBytes + 4096;
      if (declared > wireLimit) return Response.json(rejected("limit_exceeded"), { status: 413, headers });
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      if (reader) for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > wireLimit) { await reader.cancel(); return Response.json(rejected("limit_exceeded"), { status: 413, headers }); } chunks.push(next.value); }
      const all = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
    } catch { return Response.json(rejected("invalid_input"), { status: 400, headers }); }
    if (!isRecord(body) || Array.isArray(body) || body.jsonrpc !== "2.0") return Response.json(rejected("invalid_input"), { status: 400, headers });
    if (body.method === "tools/call" && body.id === undefined) return Response.json(rejected("invalid_input"), { status: 400, headers });
    if (isRecord(body.params) && body.params.task !== undefined) return Response.json(rejected("invalid_input"), { status: 400, headers });
    const server = new Server({ name: "investment-os", version: MCP_CONTRACT_VERSION }, {
      capabilities: { tools: {} }, jsonSchemaValidator: provider,
      instructions: "Contrat 1.0.0. Scope explicite requis. Aucun retry automatique save_analysis ; un timeout laisse le résultat inconnu. Les receipts sont la seule preuve retournée par le Core.",
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpToolCatalog }));
    server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      if (!Object.hasOwn(MCP_TOOLS, params.name)) throw new McpError(ErrorCode.InvalidParams, "Tool inconnu.");
      const output = await call(params.name as ToolName, params.arguments, caller!, keepAlive);
      // Some hosted clients expose only text when isError is true. Transport rejections
      // contain fixed safe diagnostics, never the input or private Core data.
      const text = output.status === "rejected" || output.result.status === "error" ? output : { contractVersion: MCP_CONTRACT_VERSION, status: output.status };
      return { structuredContent: output as unknown as Record<string, unknown>, content: [{ type: "text", text: JSON.stringify(text) }],
        isError: output.status === "rejected" || output.result.status === "error" };
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody: body });
      response.headers.set("cache-control", headers["cache-control"]);
      return response;
    } catch { return Response.json(rejected("invalid_input"), { status: 400, headers }); }
    finally { await server.close(); }
  };
}
