"use client";

import React from "react";
import type { CompanyDocument, DecisionFields, ResearchDocument } from "../lib/investment-data";
import type { AnalysisPresentationProjection, ProjectionStatus } from "../lib/presentation-projection";
import { normalizeAnalysisDocument } from "../lib/document-presentation";
import { InvestmentMemoReader } from "./investment-memo-reader";
import { AnalysisBlockBody, AnalysisFactGrid, AnalysisProjectionSummary, AnalysisReportHero, ProjectionStatusNotice } from "./analysis-presentation";
import { AnalysisSectionGroups, navigateToAnalysisSection } from "./analysis-section-groups";
import { renderInlineFormat } from "../lib/inline-format";
import { ScenarioComparison } from "./scenario-comparison";
import { analysisTypeLabel, formatAnalysisScore } from "../lib/decision-label";
import { BackButton, Badge, DisclosureSurface, MetadataGrid } from "./ui-primitives";

type AnalysisDoc = (CompanyDocument | ResearchDocument) & { presentationStatus?: ProjectionStatus; presentationProjection?: AnalysisPresentationProjection | null };

function inline(text: string) {
  text = text.replace(/\\~/g, "~");
  return renderInlineFormat(text);
}

const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Date non renseignée";
function scenarioKind(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/^\d+[.)\s-]+/, "");
  if (/^(?:bear|baissier|pessimiste)(?:\b|\s|:)/.test(normalized)) return "bear";
  if (/^(?:base|central|scénario central)(?:\b|\s|:)/.test(normalized)) return "base";
  if (/^(?:bull|haussier|optimiste)(?:\b|\s|:)/.test(normalized)) return "bull";
  return null;
}
const decisionLabels: Record<keyof DecisionFields, string> = {
  action: "Action",
  outcome: "Issue",
  account: "Compte",
  instrumentType: "Instrument",
  currentWeight: "Poids actuel",
  maximumWeight: "Poids maximum",
  maximumEntryPrice: "Prix d’entrée max.",
  nextReview: "Prochaine revue",
  confidence: "Confiance",
  coreThesis: "Thèse centrale",
  entryCondition: "Condition d’entrée",
  executionPlan: "Plan d’exécution",
  fundingSource: "Financement",
  catalyst: "Catalyseurs",
  invalidationCriteria: "Invalidation",
  keyRisk: "Risque principal",
  reviewTrigger: "Déclencheur de revue",
};
function decisionValue(key: keyof DecisionFields, value: string | null) {
  if (!value) return "—";
  if ((key === "currentWeight" || key === "maximumWeight") && /^(?:0(?:\.0+)?|0?\.\d+)$/.test(value)) {
    const percentage = Number(value) * 100;
    return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}%`;
  }
  if (key === "maximumEntryPrice" && /^\d+(?:\.\d+)?$/.test(value)) return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
  return value;
}

function DecisionTemplate({ decision }: { decision: DecisionFields }) {
  const keys: (keyof DecisionFields)[] = ["action", "account", "instrumentType", "currentWeight", "maximumWeight", "maximumEntryPrice", "nextReview", "confidence", "outcome"];
  const blocks = [

    ["Thèse centrale", decision.coreThesis],
    ["Plan d’exécution", decision.executionPlan],
    ["Condition d’entrée", decision.entryCondition],
    ["Source de financement", decision.fundingSource],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const riskBlocks = [
    ["Catalyseurs", decision.catalyst],
    ["Invalidation", decision.invalidationCriteria],
    ["Risque principal", decision.keyRisk],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <section className="decision-template">
      <div className="decision-template-head">
        <div>
          <p className="eyebrow">Décision</p>
          <h2>Cadre de décision</h2>
        </div>
      </div>
      <MetadataGrid
        className="decision-facts"
        items={keys.map((key) => ({
          label: decisionLabels[key],
          value: decisionValue(key, decision[key]),
        }))}
      />
      {blocks.map(([label, value]) => (
        <section className="decision-template-block" key={label}>
          <small>{label}</small>
          <p>{value}</p>
        </section>
      ))}
      {riskBlocks.length > 0 && (
        <div className="decision-template-columns">
          {riskBlocks.map(([label, value]) => (
            <section key={label}>
              <small>{label}</small>
              <p>{value}</p>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export function AnalysisReader({ document, companyName, onBack, embedded = false }: { document: AnalysisDoc; companyName: string; onBack?: () => void; embedded?: boolean }) {
  const normalized = React.useMemo(() => document.normalizedAnalysis ?? normalizeAnalysisDocument(document), [document]);
  if (normalized.analysis.kind === "cio_memo") {
    return <InvestmentMemoReader document={document} normalized={normalized} companyName={companyName} onBack={onBack} embedded={embedded} />;
  }
  return <StandardAnalysisReader document={document} normalized={normalized} companyName={companyName} onBack={onBack} embedded={embedded}/>;
}

type NormalizedReader = ReturnType<typeof normalizeAnalysisDocument>;

function StandardAnalysisReader({ document, normalized, companyName, onBack, embedded }: { document: AnalysisDoc; normalized: NormalizedReader; companyName: string; onBack?: () => void; embedded: boolean }) {
  const isDemo = document.id.startsWith("demo-");
  const blocks = normalized.analysis.content.blocks;
  const projection = normalized.analysis.projection.status === "valid" ? normalized.analysis.projection.projection : null;
  const documentSummary = projection ? null : normalized.view;
  const presentation = documentSummary;
  const scenarioSummary = !projection && normalized.analysis.kind === "valuation" ? normalized.valuation : null;
  const hidden = new Set(presentation?.hiddenIndexes ?? []);
  const headings = blocks.flatMap((block, index) => block.type === "heading" && block.level <= 2 && !hidden.has(index) ? [{ text: block.text.map(segment => segment.text).join(""), index, id: block.id ?? `analysis-heading-${index}` }] : []);
  const templateKind = document.category || (document.sourceKey === "decisions" ? "synthese" : "universal");
  const scored = templateKind === "business" || templateKind === "valuation";
  const formattedScore = scored ? formatAnalysisScore(document.score) : null;
  const outcome = projection ? null : document.verdict
    ? { label: document.sourceKey === "decisions" ? "Décision" : "Verdict", value: document.verdict, detail: formattedScore && formattedScore !== "—" ? formattedScore : undefined }
    : formattedScore && formattedScore !== "—"
      ? { label: "Score", value: formattedScore }
      : null;
  return (
    <section className="research-reader universal-analysis-reader" data-analysis-template={projection?.analysisType ?? templateKind} data-projection-status={normalized.analysis.projection.status}>
      {!embedded && onBack && <div className="detail-navigation"><BackButton onBack={onBack} ariaLabel="Retour à la liste précédente" /></div>}
      <AnalysisReportHero
        badges={
          <>
            <Badge>{document.agent}</Badge>
            {document.current && <Badge tone="positive">Current</Badge>}
            <Badge tone={document.status.toLowerCase().includes("valid") || document.status.toLowerCase().includes("act") ? "positive" : "warning"} className="status-badge">
              {document.status || (isDemo ? "Démo" : "Snapshot Notion")}
            </Badge>
          </>
        }
        title={analysisTypeLabel(document)}
        subtitle={<>{companyName} · {shortDate(normalized.analysis.header.date || normalized.analysis.header.provenance.capturedAt)}</>}
        outcome={outcome}
      />
      <ProjectionStatusNotice status={normalized.analysis.projection.status} diagnostics={normalized.analysis.diagnostics} />
      <div className="notion-layout universal-analysis-layout">
        <article className="notion-page universal-analysis-page">
          {projection && <AnalysisProjectionSummary projection={projection} />}
          {presentation && presentation.summaryItems.length > 0 && (
            <section className="analysis-lead">
              <section aria-labelledby="analysis-tldr">
                <span id="analysis-tldr">TL;DR</span>
                {presentation.summaryItems.length === 1 ? (
                  <p>{inline(presentation.summaryItems[0])}</p>
                ) : (
                  <ul>
                    {presentation.summaryItems.map((item, index) => (
                      <li key={index}>{inline(item)}</li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          )}
          {presentation && presentation.facts.length > 0 && (
            <AnalysisFactGrid
              ariaLabel="Repères du document"
              category={templateKind}
              facts={presentation.facts}
              renderValue={inline}
            />
          )}
          {scenarioSummary && <ScenarioComparison summary={scenarioSummary} showThresholds />}
          {document.sourceKey === "decisions" && document.decision && <DecisionTemplate decision={document.decision} />}
          <AnalysisSectionGroups blocks={blocks} hidden={hidden} factGroups={normalized.view.factGroups} idForHeading={index => `analysis-heading-${index}`} classForHeading={title => { const scenario = scenarioKind(title); return scenario ? `analysis-scenario analysis-scenario-${scenario}` : ""; }} renderBlock={({ block }) => <AnalysisBlockBody block={block as typeof blocks[number]} />} />
          <DisclosureSurface
            className="analysis-source-details"
            summary={
              <>
                <span>
                  <strong>Sources et document original</strong>
                  <small>
                    {isDemo ? `${blocks.length} blocs fictifs` : `${blocks.length} blocs Notion structurés`} · {headings.length} section{headings.length > 1 ? "s" : ""}
                  </small>
                </span>
                <b>Afficher</b>
              </>
            }
          >
            <div className="analysis-source-body">
              <nav aria-label="Sommaire du document">
                {headings.length ? (
                  headings.map((heading) => (
                    <a href={`#${heading.id}`} onClick={event => { event.preventDefault(); navigateToAnalysisSection(heading.id); }} key={heading.index}>
                      {inline(heading.text)}
                    </a>
                  ))
                ) : (
                  <span className="toc-empty">Document sans titres de section</span>
                )}
              </nav>
              {!isDemo && document.relations.length > 0 && (
                <div className="relation-list">
                  {document.relations.map((relation) => (
                    <a className={`relation-chip ${relation.property.toLowerCase() === "sources" ? "relation-source" : ""}`} href={relation.url} target="_blank" rel="noreferrer" key={`${relation.property}-${relation.id}`}>
                      <span>{relation.property}</span>
                      <strong>{relation.title}</strong>
                    </a>
                  ))}
                </div>
              )}
              {!isDemo && <a className="notion-original" href={document.notionUrl} target="_blank" rel="noreferrer">Ouvrir le document original ↗</a>}
            </div>
          </DisclosureSurface>
          <footer className="notion-page-footer">
            <span>{isDemo ? "Fin du document de démonstration" : "Fin du document synchronisé"}</span>
            {!isDemo && <a href={document.notionUrl} target="_blank" rel="noreferrer">Comparer avec Notion ↗</a>}
          </footer>
        </article>
      </div>
    </section>
  );
}
