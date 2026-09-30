"use client";

import type { ReactNode } from "react";
import type { Diagnostic } from "../../core/contracts/common";
import type { AnalysisBlock } from "../../core/contracts/analysis";
import type { PresentationFact } from "../lib/document-presentation";
import type { AnalysisPresentationProjection, ProjectionFact, ProjectionMetric, ProjectionStatus } from "../lib/presentation-projection";
import { isPriorityPresentationFact, splitPresentationFactValue } from "../lib/document-presentation";
import { renderInlineFormat, renderInlineSegments } from "../lib/inline-format";
import { PrimaryBlock, SecondaryBlock } from "./ui-primitives";
import { NotionTable } from "./notion-table";

/** One canonical body dispatcher for Standard, CIO and decision documents. */
export function AnalysisBlockBody({ block, memo = false }: { block: AnalysisBlock; memo?: boolean }) {
  if (block.type === "heading") {
    const Tag = `h${Math.min(block.level + 1, 6)}` as keyof React.JSX.IntrinsicElements;
    return <section className={`analysis-section${memo ? " memo-section-heading" : ""}`}><Tag>{renderInlineSegments(block.text)}</Tag></section>;
  }
  if (block.type === "paragraph") return <p>{renderInlineSegments(block.text)}</p>;
  if (block.type === "quote") return <blockquote>{renderInlineSegments(block.text)}</blockquote>;
  if (block.type === "callout") return <SecondaryBlock className="notion-callout"><span>{block.icon || "◆"}</span><p>{renderInlineSegments(block.text)}</p></SecondaryBlock>;
  if (block.type === "divider") return <hr />;
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return <Tag>{block.items.map((item, index) => <li key={index}>{renderInlineSegments(item)}</li>)}</Tag>;
  }
  if (block.type === "unsupported") return <p role="note" data-unsupported-block={block.sourceType}>{block.text || block.diagnostic.message}</p>;
  if (block.type === "table") return <NotionTable rows={block.rows} header={block.header} renderCell={renderInlineSegments} />;
  return null;
}

type AnalysisOutcome = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

export function AnalysisReportHero({
  badges,
  title,
  subtitle,
  outcome,
  className = "",
}: {
  badges: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  outcome?: AnalysisOutcome | null;
  className?: string;
}) {
  return (
    <PrimaryBlock as="header" className={`report-hero analysis-report-hero${outcome ? "" : " analysis-report-hero--without-outcome"} ${className}`.trim()}>
      <div>
        <div className="report-kicker">{badges}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {outcome && (
        <div className="report-verdict">
          <small>{outcome.label}</small>
          <strong>{outcome.value}</strong>
          {outcome.detail != null && <span>{outcome.detail}</span>}
        </div>
      )}
    </PrimaryBlock>
  );
}

export function AnalysisFactGrid({
  facts,
  category,
  renderValue,
  ariaLabel,
}: {
  facts: PresentationFact[];
  category: string;
  renderValue: (value: string) => ReactNode;
  ariaLabel: string;
}) {
  return (
    <dl className="analysis-key-facts" aria-label={ariaLabel}>
      {facts.map((fact) => {
        const segments = splitPresentationFactValue(fact.value);
        return <div className={isPriorityPresentationFact(category, fact.label) ? "analysis-key-fact--priority" : undefined} key={`${fact.label}-${fact.value}`}>
          <dt>{fact.label}</dt>
          <dd>{segments.length === 1
            ? renderValue(segments[0])
            : <span className="analysis-structured-value">{segments.map((segment, index) => <span key={index}>{renderValue(segment)}</span>)}</span>}</dd>
        </div>;
      })}
    </dl>
  );
}

function projectionDate(value: string | null) {
  if (!value) return "non datée";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(date) : "non datée";
}

function projectionValue(value: string | number | null, unit: string | null) {
  if (value === null) return "Indisponible";
  const formatted = typeof value === "number" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value) : value;
  return unit ? `${formatted} ${unit}` : formatted;
}

function orderedProjectionSources(projection: AnalysisPresentationProjection) {
  return [...projection.sources].sort((a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt) || a.id.localeCompare(b.id));
}

function projectionCitations(evidenceIds: string[], projection: AnalysisPresentationProjection) {
  const sources = orderedProjectionSources(projection);
  const citations = evidenceIds.flatMap(id => {
    const evidence = projection.evidence.find(item => item.id === id);
    const sourceIndex = evidence ? sources.findIndex(item => item.id === evidence.sourceId) : -1;
    return sourceIndex < 0 ? [] : [{ sourceId: sources[sourceIndex].id, label: sourceIndex + 1 }];
  });
  return citations.length ? <span className="projection-citations">{citations.map((citation, index) => <a key={`${citation.sourceId}-${index}`} href={`#analysis-projection-source-${citation.sourceId}`}>[{citation.label}]</a>)}</span> : null;
}

function metricRows(metric: ProjectionMetric, projection: AnalysisPresentationProjection) {
  if (metric.status !== "known") return null;
  return <div className="analysis-projection-metric" key={metric.id}>
    <dt>{renderInlineFormat(metric.label)}{projectionCitations(metric.evidenceIds, projection)}</dt>
    <dd>{renderInlineFormat(metric.status === "known" ? projectionValue(metric.value, metric.unit) : "Indisponible")}</dd>
  </div>;
}

function factRow(fact: ProjectionFact, projection: AnalysisPresentationProjection) {
  return <div key={fact.id}>
    <dt>{renderInlineFormat(fact.label)}{projectionCitations(fact.evidenceIds, projection)}</dt>
    <dd>{renderInlineFormat(fact.status === "known" ? projectionValue(fact.value, fact.unit) : "Indisponible")}</dd>
  </div>;
}

/** Compact evidence-linked fields; the synced Notion blocks remain the article body. */
export function AnalysisProjectionSummary({ projection }: { projection: AnalysisPresentationProjection }) {
  const sources = orderedProjectionSources(projection);
  const latestRetrievedAt = sources[0]?.retrievedAt ?? null;
  const unknownFreshness = sources.filter(source => source.freshness === "unknown").length;
  const knownFacts = projection.facts.filter(fact => fact.status === "known");
  const knownScenarios = projection.scenarios.filter(scenario => scenario.status === "known");
  const knownThresholds = projection.thresholds.filter(metric => metric.status === "known");
  return <div className="analysis-projection-summary" data-projection-contract={projection.presentationContractVersion}>
    <section className="analysis-projection-lead" aria-labelledby="analysis-projection-summary-title">
      <p className="eyebrow">Mise à jour le {projectionDate(projection.generatedAt)}</p>
      <h2 id="analysis-projection-summary-title">Synthèse</h2>
      <p>{renderInlineFormat(projection.summary.text)}{projectionCitations(projection.summary.evidenceIds, projection)}</p>
      <small>{sources.length} source{sources.length === 1 ? "" : "s"}{latestRetrievedAt ? ` consultée${sources.length === 1 ? "" : "s"} jusqu’au ${projectionDate(latestRetrievedAt)}` : " enregistrée"}{unknownFreshness ? ` · fraîcheur inconnue pour ${unknownFreshness}` : ""}</small>
    </section>
    {knownFacts.length > 0 && <section className="analysis-projection-section" aria-labelledby="analysis-projection-facts-title">
      <h2 id="analysis-projection-facts-title">Faits</h2>
      <dl className="analysis-projection-facts">{knownFacts.map(fact => factRow(fact, projection))}</dl>
    </section>}
    {knownScenarios.length > 0 && <section className="analysis-projection-section" aria-labelledby="analysis-projection-scenarios-title">
      <h2 id="analysis-projection-scenarios-title">Scénarios</h2>
      <div className="analysis-projection-scenarios">{knownScenarios.map(scenario => <div className="analysis-projection-scenario" key={scenario.id}>
        <div><h3>{renderInlineFormat(scenario.label)}{projectionCitations(scenario.evidenceIds, projection)}</h3><p>{renderInlineFormat(scenario.condition)}</p><p>{renderInlineFormat(scenario.impact)}</p></div>
        <dl>{scenario.terminalValue && metricRows(scenario.terminalValue, projection)}{scenario.cagrPercent && metricRows(scenario.cagrPercent, projection)}{scenario.horizon && metricRows(scenario.horizon, projection)}</dl>
      </div>)}</div>
    </section>}
    {knownThresholds.length > 0 && <section className="analysis-projection-section" aria-labelledby="analysis-projection-thresholds-title">
      <h2 id="analysis-projection-thresholds-title">Seuils</h2>
      <dl className="analysis-projection-thresholds">{knownThresholds.map(metric => metricRows(metric, projection))}</dl>
    </section>}
    <details className="analysis-projection-sources">
      <summary>Sources <span>{sources.length}</span></summary>
      <ol>{sources.map((source, index) => <li id={`analysis-projection-source-${source.id}`} key={source.id}>
        <a href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {renderInlineFormat(source.title)} ↗</a>
        <span>{renderInlineFormat(source.publisher || "Éditeur non précisé")} · {source.provenance === "collected_this_run" ? "Collectée pour cette analyse" : "Source de référence"}</span>
        <small>Consultée le {projectionDate(source.retrievedAt)} · Données au {projectionDate(source.asOf)}{source.publishedAt ? ` · Publiée le ${projectionDate(source.publishedAt)}` : ""} · {source.freshness === "known" ? "Date connue" : "Fraîcheur inconnue"}</small>
      </li>)}</ol>
    </details>
  </div>;
}

export function ProjectionStatusNotice({ status, diagnostics = [] }: { status?: ProjectionStatus; diagnostics?: Diagnostic[] }) {
  const sourceDiagnostics = diagnostics.filter(diagnostic => diagnostic.code === "invalid_source_date");
  return <>
    {status === "invalid" && <p className="projection-status-notice" data-projection-status="invalid">La synthèse structurée est indisponible. Le rapport source reste affiché.</p>}
    {sourceDiagnostics.map(diagnostic => <p key={diagnostic.code} className="projection-status-notice" role="note">{diagnostic.message}</p>)}
  </>;
}
