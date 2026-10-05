import { validatePresentationProjection } from "../../core/contracts/presentation-projection";
import type { ProjectionExtraction } from "../../core/contracts/presentation-projection";
export { validatePresentationProjection } from "../../core/contracts/presentation-projection";
export type {
  AnalysisPresentationProjection,
  ProjectionExtraction,
  ProjectionStatus,
  ProjectionMetric,
  ProjectionFact,
  ProjectionScenario,
  ProjectionDataCategory,
  ProjectionSource,
  ProjectionEvidence,
  ProjectionFreshnessCheck,
} from "../../core/contracts/presentation-projection";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";

function richText(block: RecordValue, type: string): string {
  const body = record(block[type]);
  const fragments = body.rich_text;
  if (!Array.isArray(fragments)) return "";
  return fragments.map(fragment => text(record(fragment).plain_text)).join("");
}

/** Find the unique marker and its immediately following Notion code block. */
export function extractPresentationProjection(blocks: unknown): ProjectionExtraction {
  const markers: { sibling: RecordValue[]; index: number }[] = [];
  const visit = (values: unknown[]) => {
    const siblings = values.map(record);
    siblings.forEach((block, index) => {
      const type = text(block.type);
      if (/^heading_[123]$/.test(type) && richText(block, type).trim() === "INVESTMENT_OS_PRESENTATION_JSON") markers.push({ sibling: siblings, index });
      if (Array.isArray(block.children)) visit(block.children);
    });
  };
  if (Array.isArray(blocks)) visit(blocks);
  if (markers.length === 0) return { status: "absent", projection: null, error: null };
  const invalid = (error: string): ProjectionExtraction => ({ status: "invalid", projection: null, error });
  if (markers.length !== 1) return invalid("Le marqueur de projection doit apparaître une seule fois.");
  const { sibling, index } = markers[0];
  const code = sibling[index + 1];
  if (!code || code.type !== "code" || text(record(code.code).language) !== "json") return invalid("Le marqueur doit être suivi immédiatement d’un bloc Notion code en JSON.");
  let projection: unknown;
  try { projection = JSON.parse(richText(code, "code")); }
  catch { return invalid("Le bloc de projection contient un JSON invalide."); }
  if (!validatePresentationProjection(projection)) return invalid("Le bloc de projection ne respecte pas le contrat versionné ou ses références de preuve.");
  return { status: "valid", projection, error: null };
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sorted(item)]));
  return value;
}

/** Canonical human report bytes shared with the plugin: Notion order is kept,
 * payload-object keys are sorted, block ids are included, machine blocks are excluded. */
export function canonicalHumanReport(blocks: unknown): string {
  const visible = humanReadableNotionBlocks(blocks);
  const canonical = visible.flatMap(value => {
    const block = record(value);
    const type = text(block.type);
    const content = block[type];
    if (!type || !content || typeof content !== "object" || Array.isArray(content)) return [];
    const children = Array.isArray(block.children) ? JSON.parse(canonicalHumanReport(block.children)) : undefined;
    return [sorted({ id: block.id ?? null, type, content: block[type], ...(children ? { children } : {}) })];
  });
  return JSON.stringify(canonical);
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Full validation against the raw imported Notion snapshot. Never promote a
 * projection when its report changed after generation or captured evidence
 * does not match its recorded digest. */
export async function verifyPresentationProjection(blocks: unknown): Promise<ProjectionExtraction> {
  const result = extractPresentationProjection(blocks);
  if (result.status !== "valid" || !result.projection) return result;
  const payload = result.projection;
  if (await sha256(canonicalHumanReport(blocks)) !== payload.reportSha256) return { status:"invalid", projection:null, error:"Le rapport Notion a changé depuis la génération de la projection." };
  for (const evidence of payload.evidence) if (await sha256(evidence.supportingData) !== evidence.supportingDataSha256) return { status:"invalid", projection:null, error:"Le hash d’une capture de source est invalide." };
  for (const check of payload.freshnessChecks) if (await sha256(check.supportingData) !== check.supportingDataSha256) return { status:"invalid", projection:null, error:"Le hash d’un contrôle de fraîcheur est invalide." };
  return result;
}

/** Preserve machine blocks in the raw snapshot while hiding them in every
 * human-facing Notion body and legacy-renderer path. */
export function humanReadableNotionBlocks(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const filtered: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const block = record(value[index]);
    const type = text(block.type);
    const fragments = record(block[type]).rich_text;
    const headingText = Array.isArray(fragments) ? fragments.map(item => text(record(item).plain_text)).join("").trim() : "";
    if (/^heading_[123]$/.test(type) && headingText === "INVESTMENT_OS_PRESENTATION_JSON") {
      if (record(value[index + 1]).type === "code") index++;
      continue;
    }
    const body = record(block[type]);
    // Provider bodies and imported snapshots enter the same reader representation.
    const sourceChildren = Array.isArray(block.children) ? block.children : body.children;
    const nested = Array.isArray(sourceChildren) ? humanReadableNotionBlocks(sourceChildren) : undefined;
    if (nested) {
      const content = { ...body };
      delete content.children;
      filtered.push({ ...block, [type]: content, children: nested });
    } else filtered.push(block);
  }
  return filtered;
}
