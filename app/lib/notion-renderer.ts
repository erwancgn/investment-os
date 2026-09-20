export type { RenderBlock } from "./notion-block-parser";
import { parseNotionBlocks, type RenderBlock } from "./notion-block-parser";

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

function textOnly(value: string): string {
  return decodeHtmlEntities(value
    .replace(/<mention-page[^>]*url="([^"]+)"[^>]*>(.*?)<\/mention-page>/gi, "[$2]($1)")
    .replace(/<mention-page[^>]*url="([^"]+)"[^>]*\s*\/>/gi, "[Page Notion]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/\\([>$~])/g, "$1")
  ).trim();
}

function htmlTables(value: string): string {
  const rowsFrom = (body: string): string[] => [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map(cell => textOnly(cell[1]).replace(/\|/g, "/").replace(/\s*\n\s*/g, " "))
  ).filter(row => row.length).map(row => row.join(" | "));

  let normalized = value.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, body: string) => rowsFrom(body).join("\n"));
  // Notion exports occasionally contain only the inner table fragment (or
  // leaves the wrapper tags in a rich-text snapshot). Parse those rows too;
  // otherwise the UI would show literal <td>/<tr> tags to the reader.
  const fragmentRows = rowsFrom(normalized);
  if (fragmentRows.length) normalized = normalized.replace(/<thead\b[^>]*>|<\/thead>|<tbody\b[^>]*>|<\/tbody>|<tfoot\b[^>]*>|<\/tfoot>/gi, "").replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row: string) => {
    const cells = [...row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => textOnly(cell[1]).replace(/\|/g, "/").replace(/\s*\n\s*/g, " "));
    return cells.length ? `${cells.join(" | ")}\n` : "";
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
  return blocks.some(block => "text" in block && /(?:<|&lt;)\s*\/?\s*(?:table|thead|tbody|tr|td|th|h[1-6]|li|p|div|br|callout|mention-page)\b/i.test(block.text));
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
    .replace(/<[^>]+>/g, "");
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
      while (index < lines.length && isTableLine(lines[index].trim())) rows.push(lines[index++].split(/\s*\|\s*/).map(textOnly));
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
  return structured.length && !hasResidualMarkup(structured) ? structured : parseNotionText(raw, title);
}
