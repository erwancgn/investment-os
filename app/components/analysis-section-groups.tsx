"use client";

import { Fragment, useCallback, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import type { RenderBlock } from "../lib/notion-renderer";
import { plainInlineText, renderInlineFormat } from "../lib/inline-format";

type Entry = { block: RenderBlock; index: number };
type Section = { title: string; id?: string; level: number; entries: Entry[]; children: Section[] };

function sectionHasContent(section: Section): boolean {
  return section.entries.length > 0 || section.children.some(sectionHasContent);
}

function disclosureCount(section: Section): number {
  const renderedAsDisclosure = section.level > 1 || section.children.length === 0;
  return (renderedAsDisclosure && sectionHasContent(section) ? 1 : 0) + section.children.reduce((count, child) => count + disclosureCount(child), 0);
}

export function navigateToAnalysisSection(sectionId: string) {
  const target = window.document.getElementById(sectionId);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.querySelector("summary")?.focus({ preventScroll: true });
  }
  target?.scrollIntoView({ block: "start" });
}

/** Group source blocks under their original headings without adding card surfaces. */
export function AnalysisSectionGroups({
  blocks, hidden, idForHeading, renderBlock, classForHeading,
}: {
  blocks: RenderBlock[];
  hidden: Set<number>;
  idForHeading: (index: number) => string;
  renderBlock: (entry: Entry) => ReactNode;
  classForHeading?: (title: string) => string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const handleToggle = useCallback((event: SyntheticEvent<HTMLDetailsElement>) => {
    const details = event.currentTarget;
    setOpenCount(container.current?.querySelectorAll("details[open]").length ?? (details.open ? 1 : 0));
  }, []);
  const roots: Section[] = [];
  let current: Section | null = null;
  let primary: Section | null = null;
  for (const [index, block] of blocks.entries()) {
    if (hidden.has(index)) continue;
    if (block.type === "heading" && block.level === 1) {
      current = { title: block.text, id: block.id ?? idForHeading(index), level: 1, entries: [], children: [] };
      roots.push(current);
      primary = current;
    } else if (block.type === "heading" && block.level === 2) {
      const section = { title: block.text, id: block.id ?? idForHeading(index), level: 2, entries: [], children: [] };
      if (primary) primary.children.push(section);
      else roots.push(section);
      current = section;
    } else {
      if (!current) {
        current = { title: "Contexte et données", level: 2, entries: [], children: [] };
        roots.push(current);
      }
      current.entries.push({ block, index });
    }
  }

  const renderSectionEntries = (entries: Entry[]) => {
    const output: ReactNode[] = [];
    for (let cursor = 0; cursor < entries.length;) {
      const pairs: { label: string; value: string; index: number }[] = [];
      let end = cursor;
      while (end < entries.length) {
        const entry = entries[end];
        if (entry.block.type !== "paragraph") break;
        const match = entry.block.text.match(/^(?:\*\*|__)?([^:：\n]{2,48}?)(?:\*\*|__)?\s*[:：]\s*(\S[\s\S]{0,159})$/);
        if (!match) break;
        pairs.push({ label: match[1].trim(), value: match[2].trim(), index: entry.index });
        end++;
      }
      if (pairs.length >= 3) {
        output.push(<dl className="analysis-key-facts" key={`key-facts-${pairs[0].index}`}>
          {pairs.map(pair => <div key={pair.index}><dt>{renderInlineFormat(pair.label)}:</dt><dd>{renderInlineFormat(pair.value)}</dd></div>)}
        </dl>);
        cursor = end;
      } else {
        output.push(<Fragment key={entries[cursor].index}>{renderBlock(entries[cursor])}</Fragment>);
        cursor++;
      }
    }
    return output;
  };
  const renderDisclosure = (section: Section): ReactNode => <details onToggle={handleToggle} className={`analysis-section-group ${classForHeading?.(plainInlineText(section.title)) ?? ""}`.trim()} id={section.id} key={section.id ?? `${section.title}-context`}>
    <summary><span role="heading" aria-level={section.level + 1}>{renderInlineFormat(section.title)}</span><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m3.5 4.5 2.5 2.5 2.5-2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg></summary>
    <div className="analysis-section-group-content">{renderSectionEntries(section.entries)}{section.children.filter(sectionHasContent).map(renderDisclosure)}</div>
  </details>;

  const totalDisclosures = roots.reduce((count, root) => count + disclosureCount(root), 0);
  return <div className="analysis-section-groups-shell" ref={container}>
    {totalDisclosures > 1 && <div className="analysis-section-controls" aria-label="Commandes des sections">
      <button type="button" onClick={() => { container.current?.querySelectorAll("details").forEach(details => { (details as HTMLDetailsElement).open = true; }); setOpenCount(totalDisclosures); }}>Tout déplier</button>
      <button type="button" onClick={() => { container.current?.querySelectorAll("details").forEach(details => { (details as HTMLDetailsElement).open = false; }); setOpenCount(0); }}>Tout replier</button>
      <span className="sr-only" aria-live="polite">{openCount} section{openCount > 1 ? "s" : ""} ouverte{openCount > 1 ? "s" : ""} sur {totalDisclosures}</span>
    </div>}
    <div className="analysis-section-groups">{roots.map((root, index) => {
    if (root.level !== 1 || root.children.length === 0) return sectionHasContent(root) ? renderDisclosure(root) : null;
    const children = root.children.filter(sectionHasContent);
    if (!root.entries.length && !children.length) return null;
    return <section className={`analysis-section-parent ${classForHeading?.(plainInlineText(root.title)) ?? ""}`.trim()} id={root.id} key={root.id ?? `${root.title}-${index}`}>
      <h2>{renderInlineFormat(root.title)}</h2>
      {root.entries.length > 0 && <div className="analysis-section-parent-content">{renderSectionEntries(root.entries)}</div>}
      {children.length > 0 && <div className="analysis-section-groups">{children.map(renderDisclosure)}</div>}
    </section>;
  })}</div>
  </div>;
}
