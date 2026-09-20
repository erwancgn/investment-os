"use client";

import type { ReactNode } from "react";
import type { PresentationFact } from "../lib/document-presentation";
import { isPriorityPresentationFact, splitPresentationFactValue } from "../lib/document-presentation";
import { MetadataGrid } from "./ui-primitives";

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
    <header className={`report-hero analysis-report-hero${outcome ? "" : " analysis-report-hero--without-outcome"} ${className}`.trim()}>
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
    </header>
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
    <MetadataGrid
      className="analysis-key-facts"
      ariaLabel={ariaLabel}
      items={facts.map((fact) => {
        const segments = splitPresentationFactValue(fact.value);
        return {
          label: fact.label,
          className: isPriorityPresentationFact(category, fact.label) ? "analysis-key-fact--priority" : undefined,
          value: segments.length === 1
            ? renderValue(segments[0])
            : <span className="analysis-structured-value">{segments.map((segment, index) => <span key={index}>{renderValue(segment)}</span>)}</span>,
        };
      })}
    />
  );
}
