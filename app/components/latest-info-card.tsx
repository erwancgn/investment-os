"use client";

import { useMemo } from "react";
import type { CompanyDocument } from "../lib/investment-data";
import { analysisDisplayValue, analysisTypeLabel, decisionParts, formatAnalysisDate } from "../lib/decision-label";
import { documentPresentation } from "../lib/document-presentation";
import { parseNotionDocument } from "../lib/notion-renderer";
import { ActionButton, Badge, MetadataGrid, PrimaryBlock } from "./ui-primitives";

function previewItems(items: string[]) {
  const sentences = items.flatMap(item => item
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9])/)
    .map(sentence => sentence.trim())
    .filter(Boolean));
  const source = sentences.length > 1 ? sentences : items;
  return { items: source.slice(0, 3), remaining: Math.max(0, source.length - 3) };
}

export function LatestInfoCard({ document, eyebrow, onOpen }: { document: CompanyDocument; eyebrow: string; onOpen: () => void }) {
  const summaryItems = useMemo(() => document.previewSummaryItems ?? documentPresentation(parseNotionDocument(document.plainText, document.title, document.notionBlocks), document.summary ?? "", { category: document.category, handoffSummary: document.handoffSummary }).summaryItems, [document]);
  const summary = summaryItems.length ? summaryItems : ["Document Notion disponible dans l’application."];
  const preview = previewItems(summary);
  const decisionSource = document.verdict || document.status;
  const headline = analysisDisplayValue(document);
  const verdict = decisionParts(decisionSource);
  const analysisDate = formatAnalysisDate(document.date, document.lastEditedTime);
  return <PrimaryBlock as="article" className="detail-card latest-info-card"><div className="detail-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{analysisTypeLabel(document)} · {analysisDate}</h2></div><Badge tone="accent" title={decisionSource || headline} ariaLabel={`Décision : ${decisionSource || headline}`}>{headline}</Badge></div><div className="latest-info-summary"><section aria-label="TL;DR"><small>TL;DR</small>{preview.items.length === 1 ? <p>{preview.items[0]}</p> : <ul>{preview.items.map((item, index) => <li key={index}>{item}</li>)}</ul>}{preview.remaining > 0 && <small className="latest-info-summary-more">+{preview.remaining} élément{preview.remaining > 1 ? "s" : ""} dans l’analyse complète</small>}</section></div><MetadataGrid items={[{ label: "Agent", value: document.agent }, { label: "Mise à jour", value: analysisDate }, { label: "Verdict", value: <span className="latest-verdict-value"><strong>{verdict.action}</strong>{verdict.detail && <small>{verdict.detail}</small>}</span> }]} className="latest-analysis-metadata" /><ActionButton className="featured-document-open" onClick={onOpen}>Lire l’analyse complète</ActionButton></PrimaryBlock>;
}
