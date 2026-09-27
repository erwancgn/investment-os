"use client";

import { Fragment, type ReactNode } from "react";
import type { RenderBlock } from "../lib/notion-renderer";
import { DisclosureSurface } from "./ui-primitives";

type Entry = { block: RenderBlock; index: number };

/** Group the visible source blocks under their original top-level headings. */
export function AnalysisSectionGroups({
  blocks, hidden, idForHeading, renderBlock, classForHeading,
}: {
  blocks: RenderBlock[];
  hidden: Set<number>;
  idForHeading: (index: number) => string;
  renderBlock: (entry: Entry) => ReactNode;
  classForHeading?: (title: string) => string;
}) {
  const groups: { title: string; id?: string; entries: Entry[] }[] = [];
  for (const [index, block] of blocks.entries()) {
    if (hidden.has(index)) continue;
    if (block.type === "heading" && block.level <= 2) {
      groups.push({ title: block.text, id: idForHeading(index), entries: [] });
    } else {
      if (!groups.length) groups.push({ title: "Contexte et données", entries: [] });
      groups[groups.length - 1].entries.push({ block, index });
    }
  }
  return <div className="analysis-section-groups">{groups.filter(group => group.entries.length > 0).map((group, index) => (
    <div className={`analysis-section-group ${classForHeading?.(group.title) ?? ""}`.trim()} id={group.id} key={`${group.id ?? "intro"}-${index}`}>
      <DisclosureSurface level="primary" summary={<strong>{group.title}</strong>}>
        <div className="analysis-section-group-content">{group.entries.map(entry => <Fragment key={entry.index}>{renderBlock(entry)}</Fragment>)}</div>
      </DisclosureSurface>
    </div>
  ))}</div>;
}
