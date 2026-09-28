"use client";

import { Fragment, useCallback, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import type { RenderBlock } from "../lib/notion-renderer";

type Entry = { block: RenderBlock; index: number };
type Section = { title: string; id?: string; level: number; entries: Entry[]; children: Section[] };

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
  let parent: Section | null = null;
  for (const [index, block] of blocks.entries()) {
    if (hidden.has(index)) continue;
    if (block.type === "heading" && block.level === 1) {
      current = { title: block.text, id: block.id ?? idForHeading(index), level: 1, entries: [], children: [] };
      roots.push(current);
      parent = current;
    } else if (block.type === "heading" && block.level === 2) {
      const section = { title: block.text, id: block.id ?? idForHeading(index), level: 2, entries: [], children: [] };
      if (parent) parent.children.push(section);
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

  const renderEntries = (entries: Entry[]) => entries.map(entry => <Fragment key={entry.index}>{renderBlock(entry)}</Fragment>);
  const renderDisclosure = (section: Section) => <details onToggle={handleToggle} className={`analysis-section-group ${classForHeading?.(section.title) ?? ""}`.trim()} id={section.id} key={section.id ?? `${section.title}-context`}>
    <summary><span role="heading" aria-level={section.level + 1}>{section.title}</span><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="m3.5 4.5 2.5 2.5 2.5-2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg></summary>
    <div className="analysis-section-group-content">{renderEntries(section.entries)}</div>
  </details>;

  const disclosureCount = roots.reduce((count, root) => count + (root.level === 1 ? root.children.filter(section => section.entries.length > 0).length : Number(root.entries.length > 0)), 0);
  return <div className="analysis-section-groups-shell" ref={container}>
    {disclosureCount > 1 && <div className="analysis-section-controls" aria-label="Commandes des sections">
      <button type="button" onClick={() => { container.current?.querySelectorAll("details").forEach(details => { (details as HTMLDetailsElement).open = true; }); setOpenCount(disclosureCount); }}>Tout déplier</button>
      <button type="button" onClick={() => { container.current?.querySelectorAll("details").forEach(details => { (details as HTMLDetailsElement).open = false; }); setOpenCount(0); }}>Tout replier</button>
      <span className="sr-only" aria-live="polite">{openCount} section{openCount > 1 ? "s" : ""} ouverte{openCount > 1 ? "s" : ""} sur {disclosureCount}</span>
    </div>}
    <div className="analysis-section-groups">{roots.map((root, index) => {
    if (root.level !== 1) return root.entries.length ? renderDisclosure(root) : null;
    const children = root.children.filter(section => section.entries.length > 0);
    if (!root.entries.length && !children.length) return null;
    return <section className={`analysis-section-parent ${classForHeading?.(root.title) ?? ""}`.trim()} id={root.id} key={root.id ?? `${root.title}-${index}`}>
      <h2>{root.title}</h2>
      {root.entries.length > 0 && <div className="analysis-section-parent-content">{renderEntries(root.entries)}</div>}
      {children.length > 0 && <div className="analysis-section-groups">{children.map(renderDisclosure)}</div>}
    </section>;
  })}</div>
  </div>;
}
