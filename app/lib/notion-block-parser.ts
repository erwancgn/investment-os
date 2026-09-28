export type RenderBlock =
  | { type: "heading"; level: number; text: string; id?: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "callout"; text: string; icon?: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; rows: string[][]; header?: boolean }
  | { type: "divider" };

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" ? value as JsonRecord : {};
const children = (block: JsonRecord): JsonRecord[] => Array.isArray(block.children) ? block.children.map(record) : [];

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map(fragment => {
    const item = record(fragment);
    const annotations = record(item.annotations);
    const raw = String(item.plain_text ?? "");
    if (!raw) return "";
    let text = raw;
    if (annotations.code === true) text = `\`${text}\``;
    else {
      if (annotations.bold === true && annotations.italic === true) text = `***${text}***`;
      else if (annotations.bold === true) text = `**${text}**`;
      else if (annotations.italic === true) text = `*${text}*`;
      if (annotations.strikethrough === true) text = `~~${text}~~`;
    }
    const href = typeof item.href === "string" ? item.href : null;
    return href ? `[${text}](${href})` : text;
  }).join("");
}

function blockText(block: JsonRecord): string {
  const type = String(block.type ?? "");
  return richText(record(block[type]).rich_text).trim();
}

function iconText(value: unknown): string {
  const icon = record(value);
  return icon.type === "emoji" ? String(icon.emoji ?? "◆") : "◆";
}

function nestedItemText(block: JsonRecord): string {
  return [blockText(block), ...children(block).map(blockText)].filter(Boolean).join(" — ");
}

function parseNodes(nodes: JsonRecord[]): RenderBlock[] {
  const output: RenderBlock[] = [];
  for (let index = 0; index < nodes.length;) {
    const block = nodes[index];
    const type = String(block.type ?? "");
    const body = record(block[type]);
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const ordered = type === "numbered_list_item";
      const items: string[] = [];
      while (index < nodes.length && String(nodes[index].type ?? "") === type) {
        const text = nestedItemText(nodes[index]);
        if (text) items.push(text);
        index++;
      }
      if (items.length) output.push({ type: "list", ordered, items });
      continue;
    }
    if (/^heading_[123]$/.test(type)) {
      const text = blockText(block);
      const id = typeof block.id === "string" && block.id.trim() ? block.id : undefined;
      if (text) output.push({ type: "heading", level: Number(type.slice(-1)), text, id });
    } else if (type === "paragraph") {
      const text = blockText(block);
      if (text) output.push({ type: "paragraph", text });
    } else if (type === "quote") {
      const text = blockText(block);
      if (text) output.push({ type: "quote", text });
    } else if (type === "callout") {
      const text = blockText(block);
      if (text) output.push({ type: "callout", text, icon: iconText(body.icon) });
    } else if (type === "divider") output.push({ type: "divider" });
    else if (type === "code") {
      const text = richText(body.rich_text);
      if (text) output.push({ type: "quote", text: `\`${text}\`` });
    } else if (type === "table") {
      const rows = children(block).filter(child => child.type === "table_row").map(row => {
        const cells = record(row.table_row).cells;
        return Array.isArray(cells) ? cells.map(richText) : [];
      }).filter(row => row.length > 0);
      if (rows.length) output.push({ type: "table", rows, header: body.has_column_header === true });
    } else if (["bookmark", "embed", "link_preview"].includes(type)) {
      const url = String(body.url ?? "");
      if (url) output.push({ type: "paragraph", text: `[${url}](${url})` });
    } else if (["image", "video", "file", "pdf", "audio"].includes(type)) {
      const caption = richText(body.caption);
      const source = record(body[String(body.type ?? "")]);
      const url = String(source.url ?? "");
      if (caption || url) output.push({ type: "paragraph", text: url ? `[${caption || "Pièce jointe Notion"}](${url})` : caption });
    } else if (type === "child_page" || type === "child_database") {
      const title = String(body.title ?? "");
      if (title) output.push({ type: "heading", level: 3, text: title });
    } else if (type === "toggle") {
      const text = blockText(block);
      if (text) output.push({ type: "callout", text, icon: "▸" });
    }
    const nested = children(block);
    if (nested.length && type !== "table") output.push(...parseNodes(nested));
    index++;
  }
  return output;
}

export function parseNotionBlocks(value: unknown): RenderBlock[] {
  return Array.isArray(value) ? parseNodes(value.map(record)) : [];
}
