"use client";

import React from "react";
import type { CompanyDocument, ResearchDocument } from "../lib/investment-data";
import type { AnalysisPresentationProjection, ProjectionStatus } from "../lib/presentation-projection";
import { normalizeAnalysisDocument } from "../lib/document-presentation";
import { analysisTypeLabel, compactDecisionLabel } from "../lib/decision-label";
import { NotionTable } from "./notion-table";
import { AnalysisBlockBody, AnalysisFactGrid, AnalysisProjectionSummary, AnalysisReportHero, ProjectionStatusNotice } from "./analysis-presentation";
import { AnalysisSectionGroups, navigateToAnalysisSection } from "./analysis-section-groups";
import { renderInlineFormat, renderInlineSegments } from "../lib/inline-format";
import { ScenarioComparison } from "./scenario-comparison";
import {
  BackButton,
  Badge,
  DisclosureSurface,
} from "./ui-primitives";

type MemoDocument = (CompanyDocument | ResearchDocument) & { presentationStatus?: ProjectionStatus; presentationProjection?: AnalysisPresentationProjection | null };

const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Date non renseignée";

export function InvestmentMemoReader({
  document,
  normalized,
  companyName,
  onBack,
  embedded = false,
}: {
  document: MemoDocument;
  normalized: ReturnType<typeof normalizeAnalysisDocument>;
  companyName: string;
  onBack?: () => void;
  embedded?: boolean;
}) {
  const isDemo = document.id.startsWith("demo-");
  const [openedAt] = React.useState(() => Date.now());
  const blocks = normalized.analysis.content.blocks;
  const projection = normalized.analysis.projection.status === "valid" ? normalized.analysis.projection.projection : null;
  const documentSummary = projection ? null : normalized.view;
  const presentation = documentSummary;
  const extractedValuation = projection ? null : normalized.valuation;
  // Keep the memo’s existing compact scenario card contract: partial valuation facts belong in the source report.
  const scenarioSummary = extractedValuation?.scenarios.length === 3 && extractedValuation.scenarios.every(item => item.terminal && item.cagr) ? extractedValuation : null;
  const { decisionFacts, modulesTable, reasoning } = normalized.memo;
  const hidden = new Set([...(presentation?.hiddenIndexes ?? []), ...normalized.memo.hiddenIndexes]);
  const memoDate = normalized.analysis.header.date || normalized.analysis.header.provenance.capturedAt;
  const ageDays = memoDate
    ? Math.floor((openedAt - new Date(memoDate).getTime()) / 86_400_000)
    : null;
  const stale = ageDays != null && ageDays > 45;
  const decisionLabel = document.verdict ? compactDecisionLabel(document.verdict) : "À statuer";

  return (
    <section
      className="research-reader universal-analysis-reader investment-memo-reader"
      data-analysis-template="memo"
      data-projection-status={normalized.analysis.projection.status}
    >
      {!embedded && onBack && <div className="detail-navigation"><BackButton onBack={onBack} ariaLabel="Retour à la fiche entreprise" /></div>}
      <AnalysisReportHero
        className="memo-hero"
        badges={
          <>
            {document.current && <Badge tone="positive">Current</Badge>}
            <Badge tone={stale ? "warning" : "positive"}>
              {stale ? "À actualiser" : document.status || "Disponible"}
            </Badge>
          </>
        }
        title={analysisTypeLabel(document)}
        subtitle={<>{companyName} · {shortDate(memoDate)}</>}
        outcome={{
          label: "Décision CIO",
          value: document.verdict || "À statuer",
          detail: stale ? `Mémo daté de ${ageDays} jours` : "Synthèse décisionnelle",
        }}
      />
      <ProjectionStatusNotice status={normalized.analysis.projection.status} diagnostics={normalized.analysis.diagnostics} />

      <div className="notion-layout universal-analysis-layout">
        <article className="notion-page universal-analysis-page memo-page">
          {projection && <AnalysisProjectionSummary projection={projection} />}
          {presentation && presentation.summaryItems.length > 0 && (
            <section className="analysis-lead memo-tldr">
              <section aria-labelledby="memo-tldr">
                <span id="memo-tldr">TL;DR</span>
                {presentation.summaryItems.length === 1 ? (
                  <p>{renderInlineFormat(presentation.summaryItems[0])}</p>
                ) : (
                  <ul>
                    {presentation.summaryItems.map((item, index) => (
                      <li key={index}>{renderInlineFormat(item)}</li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          )}

          <section
            className="memo-decision-card"
            aria-labelledby="memo-decision-title"
          >
            <div className="memo-section-title">
              <div>
                <p className="eyebrow">Decision Card</p>
                <h2 id="memo-decision-title">Décision et conditions</h2>
              </div>
              <Badge title={document.verdict || "À statuer"} ariaLabel={`Décision CIO : ${document.verdict || "À statuer"}`}>{decisionLabel}</Badge>
            </div>
            {decisionFacts.length ? (
              <AnalysisFactGrid
                ariaLabel="Decision Card du Mémo CIO"
                category="memo"
                facts={decisionFacts}
                renderValue={renderInlineFormat}
              />
            ) : (
              <p className="generic-empty">
                La Decision Card n’est pas structurée dans ce mémo.
              </p>
            )}
          </section>

          {reasoning.length > 0 && (
            <section className="memo-reasoning">
              <small>Raisonnement décisif</small>
              {reasoning.map(block => <AnalysisBlockBody key={block.id} block={block} memo />)}
            </section>
          )}
          {scenarioSummary && <ScenarioComparison summary={scenarioSummary} />}

          {modulesTable && (
            <DisclosureSurface
              level="primary"
              className="memo-modules"
              summary={
                <>
                  <span>
                    <strong>État des quatre modules</strong>
                    <small>Business · Valuation · Short · Portfolio</small>
                  </span>
                  <b>Afficher</b>
                </>
              }
            >
              <NotionTable
                rows={modulesTable.rows}
                header={modulesTable.header ?? true}
                renderCell={renderInlineSegments}
              />
            </DisclosureSurface>
          )}

          <nav className="memo-quick-nav" aria-label="Repères du Mémo CIO">
            {blocks.map((block, index) =>
              block.type === "heading" &&
              block.level <= 2 &&
              !hidden.has(index) ? (
                <a key={index} href={`#${block.id ?? `memo-heading-${index}`}`} onClick={event => { event.preventDefault(); navigateToAnalysisSection(block.id ?? `memo-heading-${index}`); }}>
                  {renderInlineSegments(block.text)}
                </a>
              ) : null,
            )}
          </nav>

          <AnalysisSectionGroups blocks={blocks} hidden={hidden} factGroups={normalized.view.factGroups} idForHeading={index => `memo-heading-${index}`} renderBlock={({ block }) => <AnalysisBlockBody block={block} memo />} />

          <DisclosureSurface
            className="analysis-source-details memo-traceability"
            summary={
              <>
                <span>
                  <strong>Sources et traçabilité</strong>
                  <small>{isDemo ? "Exemple fictif de démonstration" : "Document CIO synchronisé depuis Notion"}</small>
                </span>
                <b>Afficher</b>
              </>
            }
          >
            <div className="analysis-source-body">
              {!isDemo && document.relations.length > 0 && (
                <div className="relation-list">
                  {document.relations.map((relation) => (
                    <a
                      className="relation-chip"
                      href={relation.url}
                      target="_blank"
                      rel="noreferrer"
                      key={`${relation.property}-${relation.id}`}
                    >
                      <span>{relation.property}</span>
                      <strong>{relation.title}</strong>
                    </a>
                  ))}
                </div>
              )}
              {!isDemo && <a
                className="notion-original"
                href={document.notionUrl}
                target="_blank"
                rel="noreferrer"
              >
                Comparer avec Notion ↗
              </a>}
            </div>
          </DisclosureSurface>
        </article>
      </div>
    </section>
  );
}
