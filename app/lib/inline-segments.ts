import { isSafeHttpUrl } from "../../core/contracts/common.ts";
import type { InlineMark, InlineSegment } from "../../core/contracts/analysis";

const PART = /(<strong\b[^>]*>[\s\S]+?<\/strong\s*>|<b\b[^>]*>[\s\S]+?<\/b\s*>|<em\b[^>]*>[\s\S]+?<\/em\s*>|<i\b[^>]*>[\s\S]+?<\/i\s*>|\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|`[^`\n]+`|\*[^*\n]+\*|(?<![\p{L}\p{N}_])_[^_\n]+_(?![\p{L}\p{N}_])|\[[^\]]+\]\([^)]+\))/giu;

/** Interpret the existing inline syntax once, before React renders the content. */
export function inlineSegments(value: string, marks: InlineMark[] = [], href: string | null = null): InlineSegment[] {
  const output: InlineSegment[] = [];
  const append = (text: string, nextMarks = marks, nextHref = href) => {
    if (text) output.push({ text, marks: [...new Set(nextMarks)], href: nextHref });
  };
  for (const part of value.replace(/\\~/g, "~").split(PART).filter(Boolean)) {
    const html = part.match(/^<(strong|b|em|i)\b[^>]*>([\s\S]+)<\/\1\s*>$/i);
    if (html) {
      output.push(...inlineSegments(html[2], [...marks, /^(strong|b)$/i.test(html[1]) ? "bold" : "italic"], href));
    } else if (/^(\*\*\*|___)[\s\S]+\1$/.test(part)) {
      output.push(...inlineSegments(part.slice(3, -3), [...marks, "bold", "italic"], href));
    } else if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      output.push(...inlineSegments(part.slice(2, -2), [...marks, "bold"], href));
    } else if (part.startsWith("~~") && part.endsWith("~~")) {
      output.push(...inlineSegments(part.slice(2, -2), [...marks, "strikethrough"], href));
    } else if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      output.push(...inlineSegments(part.slice(1, -1), [...marks, "italic"], href));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      append(part.slice(1, -1), ["code"]);
    } else {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link && isSafeHttpUrl(link[2])) output.push(...inlineSegments(link[1], marks, link[2]));
      else append(part.replace(/\*\*/g, "").replace(/<\/?\s*(?:strong|b|em|i)\b[^>]*>/gi, ""));
    }
  }
  return output;
}

export function plainInlineText(value: string): string {
  return value
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "$1")
    .replace(/___([\s\S]+?)___/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<![\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])/gu, "$1")
    .replace(/<\/?\s*(?:strong|b|em|i)\b[^>]*>/gi, "");
}
