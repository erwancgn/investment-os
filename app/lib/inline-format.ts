import { createElement, Fragment, type ReactNode } from "react";

const MARKDOWN_PART = /(\*\*\*[\s\S]+?\*\*\*|___[\s\S]+?___|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g;

/** Render the small inline Markdown subset emitted by Notion rich text. */
export function renderInlineFormat(value: string): ReactNode[] {
  return value.split(MARKDOWN_PART).filter(Boolean).map((part, index) => {
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
    return createElement(Fragment, { key: index }, part.replace(/\*\*/g, ""));
  });
}
