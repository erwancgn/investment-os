/** TEMPORARY LOT 11 VALIDATION ONLY. No provider, personal data, storage or WRITE port.
 * Removed after OAuth campaign; expires automatically even if cleanup is interrupted. */
import { createInvestmentCore } from "../../core/services/investment-os";
import { createDemoInvestmentService } from "../../adapters/demo/investment-reads";
import { MCP_CONTRACT_VERSION, MCP_LIMITS } from "../../contracts/mcp";
import { isRecord } from "../../core/contracts/common";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { raceMcpDeadline, type ValidationProbe } from "./server";

const schema = { type: "object" as const, properties: {
  invocationId: { type: "string", pattern: "^lot11-[a-z0-9-]{1,80}$" },
  outputBytes: { type: "integer", minimum: 16384, maximum: 4194305 },
  delayMs: { type: "integer", minimum: 0, maximum: 125000 },
  deadlineMs: { enum: [30000, 120000] },
  fault: { enum: ["none", "http413"] },
}, required: ["invocationId", "outputBytes", "delayMs", "deadlineMs", "fault"], additionalProperties: false };
const validate = new CfWorkerJsonSchemaValidator({ draft: "7" }).getValidator(schema);
let busy = false;
const count = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const log = (value: Record<string, unknown>) => console.info(JSON.stringify({ lot11ProxyValidation: true, timestamp: new Date().toISOString(), ...value }));
const attempts = new WeakMap<Request, string>();
const info = (raw: unknown, request: Request) => {
  const args = isRecord(raw) && validate(raw).valid ? raw as { invocationId: string; outputBytes: number; delayMs: number; deadlineMs: number; fault: string } : null;
  const attemptId = attempts.get(request) ?? crypto.randomUUID();
  attempts.set(request, attemptId);
  const trace = request.headers.get("traceparent");
  return { args, attemptId, traceparent: trace && /^[0-9a-f-]{55}$/.test(trace) ? trace : null };
};
const rejected = (code: string) => ({ validationOnly: true, status: "rejected", error: { code, retryable: false }, diagnostics: [{ code: `lot11_${code}`, severity: "error" }] });

export const lot11ProxyValidation: ValidationProbe = {
  expiresAt: Date.parse("2026-10-03T18:30:00Z"),
  tool: { name: "lot11_proxy_validation", description: "TEMPORARY LOT 11 SYNTHETIC READ ONLY: owner-only bounded proxy validation, never Investment OS data or mutation. deadlineMs=120000 tests the WRITE time budget using a synthetic READ, without any WRITE permission or port.", inputSchema: schema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  intercept(body, request) {
    if (!isRecord(body) || !isRecord(body.params) || body.params.name !== this.tool.name) return;
    const i = info(body.params.arguments, request);
    if (i.args) log({ invocationId: i.args.invocationId, attemptId: i.attemptId, traceparent: i.traceparent, phase: "worker_received", rpcId: typeof body.id === "number" ? body.id : null, contentLength: request.headers.get("content-length"), sessionPresent: request.headers.has("mcp-session-id"), userAgentKind: /codex/i.test(request.headers.get("user-agent") ?? "") ? "codex" : /chatgpt/i.test(request.headers.get("user-agent") ?? "") ? "chatgpt" : "other_or_absent" });
    if (i.args?.fault !== "http413") return;
    log({ ...i, args: undefined, invocationId: i.args.invocationId, phase: "http413", rpcId: typeof body.id === "number" ? body.id : null, contentLength: request.headers.get("content-length"), coreStarted: false });
    return Response.json(rejected("limit_exceeded"), { status: 413, headers: { "cache-control": "private, no-store" } });
  },
  async response(body, response) {
    if (!isRecord(body) || !isRecord(body.params) || !isRecord(body.params.arguments)) return;
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    log({ invocationId: body.params.arguments.invocationId, phase: "http_response_ready", httpStatus: response.status, wireBytes: bytes.byteLength, wireSha256: [...digest].map(x => x.toString(16).padStart(2, "0")).join("") });
  },
  async call(raw, request, keepAlive) {
    const i = info(raw, request);
    const summary = (out: Record<string, unknown>) => ({ structuredContent: out, content: [{ type: "text" as const, text: JSON.stringify(out) }], isError: true });
    if (!i.args) return summary(rejected("invalid_input"));
    if (busy) return summary(rejected("busy"));
    busy = true;
    const args = i.args;
    const times: Record<string, number | null> = { handlerEntered: Date.now(), coreStarted: null, coreFinished: null, responseDeparted: null, abortObserved: null };
    const event = (phase: string, extra: Record<string, unknown> = {}) => log({ invocationId: args.invocationId, attemptId: i.attemptId, traceparent: i.traceparent, phase, ...times, ...extra });
    const abort = () => { times.abortObserved = Date.now(); event("request_abort"); };
    request.signal.addEventListener("abort", abort, { once: true });
    event("handler_enter", { requestedBytes: args.outputBytes, delayMs: args.delayMs, deadlineMs: args.deadlineMs });
    const demo = await createDemoInvestmentService().getCompany("demo-lumagrid");
    if (demo.status !== "ok" || !demo.data) { busy = false; return summary(rejected("fixture_unavailable")); }
    const company = structuredClone(demo.data);
    company.id = "lot11-synthetic-proxy"; company.name = "LOT 11 SYNTHETIC PROXY VALIDATION"; company.monitoringStatus = "";
    const base = await createInvestmentCore({ readCompany: async () => company }).getCompany(company.id);
    const envelope = (result: typeof base) => ({ contractVersion: MCP_CONTRACT_VERSION, scope: "demo", status: "completed", result });
    company.monitoringStatus = "X".repeat(args.outputBytes - count(envelope(base)));
    const core = createInvestmentCore({ readCompany: async () => {
      await new Promise(resolve => setTimeout(resolve, args.delayMs));
      return company;
    } });
    const task = (async (): Promise<Record<string, unknown>> => {
      times.coreStarted = Date.now(); event("core_start");
      const output = envelope(await core.getCompany(company.id));
      times.coreFinished = Date.now();
      const serializedBytes = count(output);
      event("core_end", { serializedBytes });
      if (serializedBytes !== args.outputBytes) return rejected("size_mismatch");
      if (serializedBytes > MCP_LIMITS.responseBytes) return rejected("limit_exceeded");
      return output;
    })().finally(() => { busy = false; request.signal.removeEventListener("abort", abort); });
    keepAlive?.(task.then(() => undefined));
    const output = await raceMcpDeadline(task, args.deadlineMs, () => { event("mcp_deadline"); return rejected("timeout"); });
    times.responseDeparted = Date.now();
    const metrics = { validationOnly: true, invocationId: args.invocationId, attemptId: i.attemptId, requestedBytes: args.outputBytes, serializedBytes: count(output), deadlineMs: args.deadlineMs, times, status: output.status, error: output.error ?? null };
    event("response_departure", metrics);
    return { structuredContent: output, content: [{ type: "text", text: JSON.stringify(metrics) }], isError: output.status === "rejected" };
  },
};
