/** Contract 1.1 report form → canonical Analysis. Pure and deterministic: no clock, no I/O. */
import { SCHEMA_VERSION, isRecord } from "../contracts/common.ts";
import type { Analysis, AnalysisBlock, AnalysisContent, EarningsRefresh, InlineSegment } from "../contracts/analysis.ts";
import type { ReportKind, ReportRefreshStatus, SaveAnalysisInput, SaveReportInput } from "../services/ports.ts";

export const REPORT_LIMITS = { markdownChars: 400_000, textChars: 10_000, titleChars: 500, runIdChars: 200 } as const;
const KINDS: readonly ReportKind[] = ["business", "valuation", "short", "portfolio", "cio_memo", "earnings"];
const AGENTS: Record<ReportKind, string> = { business: "Business Analyst", valuation: "Valuation Analyst", short: "Short Seller", portfolio: "Portfolio Manager", cio_memo: "Investment Memo", earnings: "Earnings" };
const REFRESH_KEYS = ["business", "valuation", "short", "portfolio", "memo"] as const;
const REFRESH_LABELS: Record<(typeof REFRESH_KEYS)[number], string> = { business: "Business", valuation: "Valorisation", short: "Short", portfolio: "Portfolio", memo: "Mémo CIO" };
const GUIDANCE_VS_CONSENSUS = ["Above", "Inline", "Below", "Not Available"] as const;
const REFRESH_STATUSES: readonly ReportRefreshStatus[] = ["not-needed", "monitor", "recommended", "required"];
const EVIDENCE = /\[E:([A-Za-z0-9][A-Za-z0-9_.:-]{0,127})\]/g;

export type ReportBuild = { ok: true; input: SaveAnalysisInput; issues: [] } | { ok: false; issues: string[] };

/** Header id synthesized for a report; never a provider page id. */
export const reportAnalysisId = (runId: string, kind: string) => `report:${runId}:${kind}`;

export function isReportInput(value: unknown): value is SaveReportInput {
  return isRecord(value) && value.format === "report";
}

const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
const nullableText = (value: unknown, max: number) => value === null || text(value, max);
function isoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function blockText(block: AnalysisBlock): string {
  const join = (segments: InlineSegment[]) => segments.map(segment => segment.text).join("");
  if (block.type === "list") return block.items.map(join).join("\n");
  if (block.type === "table") return block.rows.map(row => row.map(join).join(" ")).join("\n");
  if (block.type === "divider") return "";
  if (block.type === "unsupported") return block.text ?? "";
  return join(block.text);
}

/** Field-level issues only: names and rules, never echoed values. */
function validate(input: SaveReportInput): string[] {
  const issues: string[] = [];
  const allowed = new Set(["format", "runId", "kind", "companyId", "title", "date", "status", "reportMarkdown", "summary", "verdict", "confidence", "score", "handoffSummary", "earnings"]);
  const unknown = Object.keys(input).filter(key => !allowed.has(key)).length;
  if (unknown) issues.push(`${unknown} unknown report field${unknown > 1 ? "s" : ""}`);
  if (!text(input.runId, REPORT_LIMITS.runIdChars) || !input.runId.trim() || input.runId.trim() !== input.runId) issues.push("runId must be a non-empty trimmed string");
  if (!KINDS.includes(input.kind)) issues.push(`kind must be one of ${KINDS.join(", ")}`);
  if (!text(input.companyId, 512) || !input.companyId.trim() || input.companyId.trim() !== input.companyId) issues.push("companyId must be a non-empty trimmed string");
  if (!text(input.title, REPORT_LIMITS.titleChars) || !input.title.trim()) issues.push("title must be a non-empty string");
  if (!isoDate(input.date)) issues.push("date must be an ISO calendar date (YYYY-MM-DD)");
  if (input.status !== "Draft" && input.status !== "Validated") issues.push("status must be Draft or Validated");
  if (typeof input.reportMarkdown !== "string") issues.push("reportMarkdown must be a string");
  else if (input.reportMarkdown.length > REPORT_LIMITS.markdownChars) issues.push(`reportMarkdown exceeds ${REPORT_LIMITS.markdownChars} characters`);
  else if (!input.reportMarkdown.trim()) issues.push("reportMarkdown is empty");
  for (const key of ["summary", "verdict"] as const) if (!nullableText(input[key], REPORT_LIMITS.textChars)) issues.push(`${key} must be a string or null`);
  if (!(input.confidence === null || input.confidence === "High" || input.confidence === "Medium" || input.confidence === "Low")) issues.push("confidence must be High, Medium, Low or null");
  const scored = input.kind === "business" || input.kind === "valuation";
  if (input.score !== undefined && input.score !== null) {
    if (!scored) issues.push("score is only allowed for business and valuation");
    else if (!Number.isInteger(input.score) || input.score < 0 || input.score > 100) issues.push("score must be an integer between 0 and 100");
  }
  if (input.handoffSummary !== undefined && input.handoffSummary !== null) {
    if (input.kind !== "cio_memo") issues.push("handoffSummary is only allowed for cio_memo");
    else if (!text(input.handoffSummary, REPORT_LIMITS.textChars)) issues.push("handoffSummary must be a string or null");
  }
  if (input.kind === "earnings") {
    const e = input.earnings;
    if (!isRecord(e)) issues.push("earnings is required for earnings");
    else {
      if (!(e.guidanceVsConsensus === null || (GUIDANCE_VS_CONSENSUS as readonly unknown[]).includes(e.guidanceVsConsensus))) issues.push(`earnings.guidanceVsConsensus must be ${GUIDANCE_VS_CONSENSUS.join(", ")} or null`);
      for (const key of ["fiscalPeriod", "guidance"] as const) if (!nullableText(e[key], REPORT_LIMITS.textChars)) issues.push(`earnings.${key} must be a string or null`);
      const refreshes = isRecord(e.refreshes) ? e.refreshes : null;
      if (!refreshes || Object.keys(refreshes).some(key => !(REFRESH_KEYS as readonly string[]).includes(key))) issues.push(`earnings.refreshes must only contain ${REFRESH_KEYS.join(", ")}`);
      else for (const key of REFRESH_KEYS) {
        const value = refreshes[key];
        if (!(value === null || value === undefined || REFRESH_STATUSES.includes(value as ReportRefreshStatus))) issues.push(`earnings.refreshes.${key} must be ${REFRESH_STATUSES.join(", ")} or null`);
      }
    }
  } else if (input.earnings !== undefined) issues.push("earnings is only allowed for earnings");
  return issues;
}

/** Notion request limits the writer enforces (2000 chars per text piece or link, 100 items per array). Named here so a refusal says which rule. */
function segmentGroups(block: AnalysisBlock): InlineSegment[][] {
  if (block.type === "list") return block.items;
  if (block.type === "table") return block.rows.flat();
  if (block.type === "divider" || block.type === "unsupported") return [];
  return [block.text];
}
function providerLimitIssues(block: AnalysisBlock): string[] {
  const issues: string[] = [];
  const groups = segmentGroups(block);
  const pieces = (group: InlineSegment[]) => group.reduce((sum, segment) => sum + Math.max(1, Math.ceil(segment.text.length / 2000)), 0);
  if (groups.some(group => pieces(group) > 100)) issues.push("a paragraph, list item or table cell has more than 100 formatted segments");
  if (groups.some(group => group.some(segment => (segment.href?.length ?? 0) > 2000))) issues.push("link longer than 2000 characters");
  if (block.type === "table" && block.rows.length > 100) issues.push("table has more than 100 rows");
  return issues;
}

/** Build the canonical Analysis from a report. `render` is the adapter's existing Markdown reader. */
export function analysisFromReport(input: SaveReportInput, render: (markdown: string) => AnalysisContent): ReportBuild {
  if (!isReportInput(input)) return { ok: false, issues: ["format must be report"] };
  const issues = validate(input);
  if (issues.length) return { ok: false, issues };
  const rendered = render(input.reportMarkdown).blocks;
  const blocks: AnalysisBlock[] = rendered.map((block, index) => {
    const id = `${input.runId}:${input.kind}:b${index}`;
    // Notion tables are rectangular: a short or long row (model-written Markdown) is completed with empty cells, never refused.
    if (block.type === "table") {
      const width = Math.max(0, ...block.rows.map(row => row.length));
      block = { ...block, rows: block.rows.map(row => row.length === width ? row : [...row, ...Array.from({ length: width - row.length }, () => [] as InlineSegment[])]) };
    }
    const evidence = [...new Set(Array.from(blockText(block).matchAll(EVIDENCE), match => match[1]))];
    return { ...block, id, sourceIds: evidence.length ? evidence : [`derived:${id}`] } as AnalysisBlock;
  });
  blocks.forEach((block, index) => {
    if (block.type === "heading" && block.level > 3) issues.push(`heading level 4 or deeper is not supported (block ${index})`);
    if (block.type === "unsupported") issues.push(`unsupported block (block ${index})`);
    for (const rule of providerLimitIssues(block)) issues.push(`${rule} (block ${index})`);
  });
  if (!blocks.length) issues.push("reportMarkdown has no readable block");
  if (issues.length) return { ok: false, issues };
  const kind = input.kind;
  const base = {
    schemaVersion: SCHEMA_VERSION,
    kind,
    header: {
      schemaVersion: SCHEMA_VERSION, id: reportAnalysisId(input.runId, kind), title: input.title.trim(), sourceUrl: null,
      family: kind, originalFamily: null, sourceKind: "analysis" as const, agent: AGENTS[kind], status: input.status,
      date: input.date, lastEditedTime: `${input.date}T00:00:00.000Z`, companyIds: [input.companyId],
      // Freshness is a property of the model's sources, which the server cannot verify.
      revision: `report:${input.runId}`, sourceFreshness: "unknown" as const, archived: false,
      provenance: { kind: "derived" as const, sourceId: input.runId, revision: null, capturedAt: null },
    },
    content: { schemaVersion: SCHEMA_VERSION, blocks },
    summary: input.summary, verdict: input.verdict, confidence: input.confidence,
    presentation: { facts: [], scenarios: [], thresholds: [] },
    projection: { status: "absent" as const },
    diagnostics: [],
  };
  let analysis: Analysis;
  if (kind === "business" || kind === "valuation") analysis = { ...base, kind, header: { ...base.header, family: kind }, score: input.score === undefined || input.score === null ? null : String(input.score) } as Analysis;
  else if (kind === "cio_memo") analysis = { ...base, kind, header: { ...base.header, family: kind }, handoffSummary: input.handoffSummary ?? null } as Analysis;
  else if (kind === "earnings") {
    const e = input.earnings!;
    const refreshes: EarningsRefresh[] = REFRESH_KEYS.flatMap(key => {
      const status = e.refreshes[key];
      return status ? [{ key, label: REFRESH_LABELS[key], status, rawValue: null }] : [];
    });
    analysis = { ...base, kind, header: { ...base.header, family: kind }, earningsReview: { fiscalPeriod: e.fiscalPeriod, guidance: e.guidance, guidanceVsConsensus: e.guidanceVsConsensus, confidence: input.confidence, refreshes } } as Analysis;
  } else analysis = { ...base, kind, header: { ...base.header, family: kind } } as Analysis;
  return { ok: true, input: { analysis, runId: input.runId, expectedRevision: null, companyIds: [input.companyId] }, issues: [] };
}
