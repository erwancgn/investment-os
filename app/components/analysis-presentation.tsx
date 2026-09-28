"use client";

import type { ReactNode } from "react";
import type { PresentationFact } from "../lib/document-presentation";
import type { AnalysisPresentationProjection, ProjectionFact, ProjectionMetric, ProjectionStatus } from "../lib/presentation-projection";
import { isPriorityPresentationFact, splitPresentationFactValue } from "../lib/document-presentation";
import { PrimaryBlock } from "./ui-primitives";

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

function projectionCitations(evidenceIds: string[], projection: AnalysisPresentationProjection) {
  const citations = evidenceIds.flatMap(id => {
    const evidence = projection.evidence.find(item => item.id === id);
    const sourceIndex = evidence ? projection.sources.findIndex(item => item.id === evidence.sourceId) : -1;
    return sourceIndex < 0 ? [] : [{ sourceId: projection.sources[sourceIndex].id, label: sourceIndex + 1 }];
  });
  return citations.length ? <span className="projection-citations">{citations.map((citation, index) => <a key={`${citation.sourceId}-${index}`} href={`#analysis-projection-source-${citation.sourceId}`}>[{citation.label}]</a>)}</span> : null;
}

function metricRows(metric: ProjectionMetric, projection: AnalysisPresentationProjection) {
  if (metric.status !== "known") return null;
  return <div className="analysis-projection-metric" key={metric.id}>
    <dt>{metric.label}{projectionCitations(metric.evidenceIds, projection)}</dt>
    <dd>{metric.status === "known" ? projectionValue(metric.value, metric.unit) : "Indisponible"}</dd>
  </div>;
}

function factRow(fact: ProjectionFact, projection: AnalysisPresentationProjection) {
  return <div key={fact.id}>
    <dt>{fact.label}{projectionCitations(fact.evidenceIds, projection)}</dt>
    <dd>{fact.status === "known" ? projectionValue(fact.value, fact.unit) : "Indisponible"}</dd>
  </div>;
}

/** Compact evidence-linked fields; the synced Notion blocks remain the article body. */
export function AnalysisProjectionSummary({ projection }: { projection: AnalysisPresentationProjection }) {
  const sources = [...projection.sources].sort((a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt));
  const latestRetrievedAt = sources[0]?.retrievedAt ?? null;
  const unknownFreshness = sources.filter(source => source.freshness === "unknown").length;
  const knownFacts = projection.facts.filter(fact => fact.status === "known");
  const knownScenarios = projection.scenarios.filter(scenario => scenario.status === "known");
  const knownThresholds = projection.thresholds.filter(metric => metric.status === "known");
  return <div className="analysis-projection-summary" data-projection-contract={projection.presentationContractVersion}>
    <section className="analysis-projection-lead" aria-labelledby="analysis-projection-summary-title">
      <p className="eyebrow">Mise à jour le {projectionDate(projection.generatedAt)}</p>
      <h2 id="analysis-projection-summary-title">Synthèse</h2>
      <p>{projection.summary.text}{projectionCitations(projection.summary.evidenceIds, projection)}</p>
      <small>{sources.length} source{sources.length === 1 ? "" : "s"}{latestRetrievedAt ? ` consultée${sources.length === 1 ? "" : "s"} jusqu’au ${projectionDate(latestRetrievedAt)}` : " enregistrée"}{unknownFreshness ? ` · fraîcheur inconnue pour ${unknownFreshness}` : ""}</small>
    </section>
    {knownFacts.length > 0 && <section className="analysis-projection-section" aria-labelledby="analysis-projection-facts-title">
      <h2 id="analysis-projection-facts-title">Faits</h2>
      <dl className="analysis-projection-facts">{knownFacts.map(fact => factRow(fact, projection))}</dl>
    </section>}
    {knownScenarios.length > 0 && <section className="analysis-projection-section" aria-labelledby="analysis-projection-scenarios-title">
      <h2 id="analysis-projection-scenarios-title">Scénarios</h2>
      <div className="analysis-projection-scenarios">{knownScenarios.map(scenario => <div className="analysis-projection-scenario" key={scenario.id}>
        <div><h3>{scenario.label}{projectionCitations(scenario.evidenceIds, projection)}</h3><p>{scenario.condition}</p><p>{scenario.impact}</p></div>
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
        <a href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.title} ↗</a>
        <span>{source.publisher || "Éditeur non précisé"} · {source.provenance === "collected_this_run" ? "Collectée pour cette analyse" : "Source de référence"}</span>
        <small>Consultée le {projectionDate(source.retrievedAt)} · Données au {projectionDate(source.asOf)}{source.publishedAt ? ` · Publiée le ${projectionDate(source.publishedAt)}` : ""} · {source.freshness === "known" ? "Date connue" : "Fraîcheur inconnue"}</small>
      </li>)}</ol>
    </details>
  </div>;
}

export function ProjectionStatusNotice({ status }: { status?: ProjectionStatus }) {
  if (status === "invalid") return <p className="projection-status-notice" data-projection-status="invalid">La synthèse structurée est indisponible. Le rapport source reste affiché.</p>;
  return null;
}
