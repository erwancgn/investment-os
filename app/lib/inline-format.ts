import { createElement, Fragment, type ReactNode } from "react";

const MARKDOWN_PART = /(<strong\b[^>]*>[\s\S]+?<\/strong\s*>|<b\b[^>]*>[\s\S]+?<\/b\s*>|<em\b[^>]*>[\s\S]+?<\/em\s*>|<i\b[^>]*>[\s\S]+?<\/i\s*>|\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/gi;

export function plainInlineText(value: string): string {
  return value
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "$1")
    .replace(/___([\s\S]+?)___/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/<\/?\s*(?:strong|b|em|i)\b[^>]*>/gi, "");
}

/** Render the supported inline emphasis syntax into semantic HTML elements. */
export function renderInlineFormat(value: string): ReactNode[] {
  return value.split(MARKDOWN_PART).filter(Boolean).map((part, index) => {
    const htmlEmphasis = part.match(/^<(strong|b|em|i)\b[^>]*>([\s\S]+)<\/\1\s*>$/i);
    if (htmlEmphasis) {
      const tag = /^(?:strong|b)$/i.test(htmlEmphasis[1]) ? "strong" : "em";
      return createElement(tag, { key: index }, renderInlineFormat(htmlEmphasis[2]));
    }
    if ((part.startsWith("***") && part.endsWith("***")) || (part.startsWith("___") && part.endsWith("___"))) {
      return createElement("strong", { key: index }, createElement("em", null, renderInlineFormat(part.slice(3, -3))));
    }
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return createElement("strong", { key: index }, renderInlineFormat(part.slice(2, -2)));
    }
    if (part.startsWith("~~") && part.endsWith("~~")) return createElement("del", { key: index }, renderInlineFormat(part.slice(2, -2)));
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return createElement("em", { key: index }, renderInlineFormat(part.slice(1, -1)));
    }
    if (part.startsWith("`") && part.endsWith("`")) return createElement("code", { key: index }, part.slice(1, -1));
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return createElement("a", { href: link[2], target: "_blank", rel: "noreferrer", key: index }, renderInlineFormat(link[1]));
    // A malformed bold delimiter must not leak literal ** into an analysis.
    return createElement(Fragment, { key: index }, part.replace(/\*\*/g, "").replace(/<\/?\s*(?:strong|b|em|i)\b[^>]*>/gi, ""));
  });
}
