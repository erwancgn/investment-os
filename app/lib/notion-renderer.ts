export type { RenderBlock } from "./notion-block-parser";
import { parseNotionBlocks, type RenderBlock } from "./notion-block-parser.ts";
import { SCHEMA_VERSION } from "../../core/contracts/common.ts";
import type { AnalysisBlock, AnalysisContent } from "../../core/contracts/analysis";
import { inlineSegments } from "./inline-segments.ts";

const metadataNames = new Set([
  "agent", "analysis", "analysis id", "account", "action", "catalyst", "company", "company business",
  "company currency", "company earnings", "company ticker", "company valuation", "confidence", "core thesis",
  "created", "currency", "current weight", "data cutoff", "decision", "decision date", "decision id", "earnings",
  "entry condition", "evidence coverage %", "evidence gaps", "execution plan", "financial period", "framework version",
  "funding source", "handoff summary", "instrument type", "invalidation criteria", "key risk", "last edited",
  "maximum entry price", "maximum weight", "next review", "outcome", "post mortem", "previous version",
  "reference price", "refresh trigger", "report depth", "review trigger", "score", "signal", "source count",
  "source freshness", "sources", "status", "verdict", "version", "analysis date", "date", "url",
]);

const entityMap: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeHtmlEntities(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 3; pass++) {
    const next = decoded.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, key: string) => {
      if (key[0] === "#") {
        const number = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : _;
      }
      return entityMap[key.toLowerCase()] ?? _;
    });
    decoded = next;
    if (next === value) break;
    value = next;
  }
  return decoded;
}

/** An HTML/Notion tag starts with a letter or "/" and stays on one line: "<10 %" or "a < b ... c > d" is text, never markup. */
const TAG = /<\/?[A-Za-z][^<>\n]*>/g;

function textOnly(value: string): string {
  return decodeHtmlEntities(value
    .replace(/<mention-page[^>]*url="([^"]+)"[^>]*>(.*?)<\/mention-page>/gi, "[$2]($1)")
    .replace(/<mention-page[^>]*url="([^"]+)"[^>]*\s*\/>/gi, "[Page Notion]($1)")
    .replace(TAG, "")
    .replace(/\\([>$~])/g, "$1")
  ).trim();
}

function htmlTables(value: string): string {
  const rowsFrom = (body: string): string[] => [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map(cell => textOnly(cell[1]).replace(/\|/g, "/").replace(/\s*\n\s*/g, " "))
  ).filter(row => row.length).map(row => `| ${row.join(" | ")} |`);

  let normalized = value.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, body: string) => rowsFrom(body).join("\n"));
  // Notion exports occasionally contain only the inner table fragment (or
  // leaves the wrapper tags in a rich-text snapshot). Parse those rows too;
  // otherwise the UI would show literal <td>/<tr> tags to the reader.
  const fragmentRows = rowsFrom(normalized);
  if (fragmentRows.length) normalized = normalized.replace(/<thead\b[^>]*>|<\/thead>|<tbody\b[^>]*>|<\/tbody>|<tfoot\b[^>]*>|<\/tfoot>/gi, "").replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row: string) => {
    const cells = [...row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => textOnly(cell[1]).replace(/\|/g, "/").replace(/\s*\n\s*/g, " "));
    return cells.length ? `| ${cells.join(" | ")} |\n` : "";
  });
  return normalized;
}

function htmlCallouts(value: string): string {
  return value.replace(/<callout\b[^>]*>([\s\S]*?)<\/callout>/gi, (_, body: string) => {
    const cleaned = textOnly(body).replace(/\s*\n\s*/g, " ");
    return `\n> ${cleaned}\n`;
  });
}

function extractContent(raw: string): string {
  const decoded = decodeHtmlEntities(raw);
  const content = decoded.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i);
  return content ? content[1] : decoded;
}

export function hasResidualMarkup(blocks: RenderBlock[]): boolean {
  const residual = /(?:<|&lt;)\s*\/?\s*(?:table|thead|tbody|tr|td|th|h[1-6]|li|p|div|br|callout|mention-page)\b/i;
  return blocks.some(block => {
    if ("text" in block && residual.test(block.text)) return true;
    if (block.type === "list") return block.items.some(item => residual.test(item));
    if (block.type === "table") return block.rows.some(row => row.some(cell => residual.test(cell)));
    return false;
  });
}

export function normalizeNotionText(raw: string, title = ""): string {
  let value = extractContent(raw);
  value = htmlTables(value);
  value = htmlCallouts(value)
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => `${"#".repeat(Number(level))} ${textOnly(body)}\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => `- ${textOnly(body)}\n`)
    .replace(/<br\s*\/?>(?:\n)?/gi, "\n")
    .replace(/<\/?(?:p|div|section|article|ul|ol|blockquote)\b[^>]*>/gi, "\n")
    .replace(TAG, "");
  value = decodeHtmlEntities(value).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");
  let lines = value.split("\n").map(line => line.trim());
  if (title && lines[0]?.toLowerCase() === title.trim().toLowerCase()) lines = lines.slice(1);
  let bodyStart = 0;
  for (; bodyStart < Math.min(lines.length, 100); bodyStart++) {
    const line = lines[bodyStart];
    if (!line) continue;
    if (/^#{1,6}\s|^>|^[-*•]\s|^\d+[.)]\s/.test(line)) break;
    const property = line.match(/^([^:]{2,60}):\s*(.*)$/);
    if (property && metadataNames.has(property[1].trim().toLowerCase())) continue;
    break;
  }
  return lines.slice(bodyStart).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isTableLine(line: string): boolean {
  const parts = line.split("|");
  return parts.length >= 3 && !/^https?:\/\//i.test(line);
}

export function parseNotionText(raw: string, title = ""): RenderBlock[] {
  const lines = normalizeNotionText(raw, title).split("\n");
  const blocks: RenderBlock[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    if (/^---+$/.test(line)) { blocks.push({ type: "divider" }); index++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { blocks.push({ type: "heading", level: heading[1].length, text: textOnly(heading[2]) }); index++; continue; }
    if (line.startsWith(">")) {
      const parts: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) parts.push(lines[index++].trim().replace(/^>\s?/, ""));
      const text = textOnly(parts.join("\n"));
      blocks.push({ type: /tl;?dr|verdict|à retenir|attention|conclusion/i.test(text) ? "callout" : "quote", text });
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (ordered || bullet) {
      const isOrdered = Boolean(ordered); const items: string[] = [];
      const pattern = isOrdered ? /^\d+[.)]\s+(.+)$/ : /^[-*•]\s+(.+)$/;
      while (index < lines.length) { const item = lines[index].trim().match(pattern); if (!item) break; items.push(textOnly(item[1])); index++; }
      blocks.push({ type: "list", ordered: isOrdered, items }); continue;
    }
    if (isTableLine(line)) {
      const rows: string[][] = [];
      while (index < lines.length && isTableLine(lines[index].trim())) {
        const source = lines[index++].trim();
        const cells = source.replace(/^\|/, "").replace(/\|$/, "").split(/\s*\|\s*/).map(textOnly);
        // GFM: the delimiter row is the second line and every cell is hyphens with optional colons (one hyphen suffices).
        // Position matters: a lone "-" in a later row is data.
        if (rows.length === 1 && cells.every(cell => /^:?-+:?$/.test(cell))) continue;
        if (cells.some(cell => !/^:?-{3,}:?$/.test(cell))) rows.push(cells);
      }
      blocks.push({ type: "table", rows, header: true }); continue;
    }
    const paragraph = [line]; index++;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,6})\s|^>|^[-*•]\s|^\d+[.)]\s|^---+$/.test(next) || isTableLine(next)) break;
      paragraph.push(next); index++;
    }
    const text = textOnly(paragraph.join(" "));
    if (text) blocks.push({ type: /^(tl;?dr|verdict|à retenir|conclusion|décision)\b/i.test(text) ? "callout" : "paragraph", text });
  }
  return blocks;
}

export function parseNotionDocument(raw: string, title = "", notionBlocks?: unknown[]): RenderBlock[] {
  const structured = parseNotionBlocks(notionBlocks);
  if (!structured.length) return parseNotionText(raw, title);
  const fallback = parseNotionText(raw, title);
  const fragments = (blocks: RenderBlock[]) => blocks.flatMap(block => block.type === "list" ? block.items : block.type === "table" ? block.rows.flat() : "text" in block ? [block.text] : [])
    .map(text => textOnly(text).replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);
  const represented = fragments(structured);
  const historical = fragments(fallback);
  // Compare ordered occurrences, rather than a set: repeated business claims must survive.
  const covers = (whole: string[], parts: string[]) => {
    const text = whole.join(" ");
    let cursor = 0;
    return parts.every(part => { const index = text.indexOf(part, cursor); if (index < 0) return false; cursor = index + part.length; return true; });
  };
  if ((!hasResidualMarkup(structured) && covers(represented, historical)) || !fallback.length) return structured;
  if (covers(historical, represented)) {
    // Retain unknown source types as diagnostics even when historic text covers their content.
    const diagnostics = structured.filter(block => block.type === "unsupported").map(block => ({ ...block, text: "" }));
    return [...fallback, ...diagnostics];
  }
  // Neither snapshot covers the other: retain structured IDs and surface unrepresented text.
  const text = represented.join(" ");
  const missing = fallback.filter(block => fragments([block]).some(fragment => !text.includes(fragment)));
  return [...structured, ...missing.map(block => ({ type: "unsupported" as const, sourceType: "unrepresented_snapshot", text: block.type === "list" ? block.items.join("\n") : block.type === "table" ? block.rows.map(row => row.join(" | ")).join("\n") : "text" in block ? block.text : "" }))];
}

/** Convert the single existing parser's output into the versioned portable block contract. */
export function canonicalAnalysisContent(documentId: string, blocks: RenderBlock[]): AnalysisContent {
  const used = new Set<string>();
  const segments = (text: string) => inlineSegments(decodeHtmlEntities(text.replace(/<\/?(?:table|thead|tbody|tr|td|th|h[1-6]|li|p|div|br|callout)\b[^>]*>/gi, "")));
  const canonical: AnalysisBlock[] = blocks.map((block, index) => {
    const sourceIds = block.sourceIds?.length ? [...new Set(block.sourceIds)] : [block.id || documentId];
    let id = block.id || `${documentId}:block:${index}`;
    while (used.has(id)) id = `${id}:duplicate:${index}`;
    used.add(id);
    const base = { id, sourceIds };
    if (block.type === "heading") return { ...base, type: "heading", level: Math.max(1, Math.min(6, block.level)) as 1 | 2 | 3 | 4 | 5 | 6, text: segments(block.text) };
    if (block.type === "paragraph" || block.type === "quote") return { ...base, type: block.type, text: segments(block.text) };
    if (block.type === "callout") return { ...base, type: "callout", text: segments(block.text), icon: block.icon ?? null };
    if (block.type === "list") return { ...base, type: "list", ordered: block.ordered, items: block.items.map(segments) };
    if (block.type === "table") return { ...base, type: "table", rows: block.rows.map(row => row.map(segments)), header: block.header ?? true };
    if (block.type === "unsupported") return { ...base, type: "unsupported", sourceType: block.sourceType, text: block.text || null, diagnostic: { code: "unsupported_block", message: `Bloc ${block.sourceType} non pris en charge par le lecteur.`, severity: "warning" } };
    return { ...base, type: "divider" };
  });
  return { schemaVersion: SCHEMA_VERSION, blocks: canonical };
}
