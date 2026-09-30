import { createElement, Fragment, type ReactNode } from "react";
import type { InlineSegment } from "../../core/contracts/analysis";
import { inlineSegments } from "./inline-segments.ts";

export { plainInlineText } from "./inline-segments.ts";

/** Render the supported inline emphasis syntax into semantic HTML elements. */
export function renderInlineFormat(value: string): ReactNode[] {
  return renderInlineSegments(inlineSegments(value));
}

export function renderInlineSegments(segments: InlineSegment[]): ReactNode[] {
  return segments.map((segment, index) => {
    let element: ReactNode = segment.text;
    if (segment.marks.includes("code")) element = createElement("code", null, element);
    else {
      if (segment.marks.includes("italic")) element = createElement("em", null, element);
      if (segment.marks.includes("bold")) element = createElement("strong", null, element);
      if (segment.marks.includes("strikethrough")) element = createElement("del", null, element);
    }
    if (segment.href) element = createElement("a", { href: segment.href, target: "_blank", rel: "noreferrer" }, element);
    return createElement(Fragment, { key: index }, element);
  });
}
