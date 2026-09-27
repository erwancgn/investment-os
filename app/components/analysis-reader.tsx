"use client";

import React from "react";
import type { CompanyDocument, DecisionFields, ResearchDocument } from "../lib/investment-data";
import { documentPresentation, hidePromotedTableSections } from "../lib/document-presentation";
import { parseNotionDocument } from "../lib/notion-renderer";
import { NotionTable } from "./notion-table";
import { InvestmentMemoReader } from "./investment-memo-reader";
import { AnalysisFactGrid, AnalysisReportHero } from "./analysis-presentation";
import { AnalysisSectionGroups } from "./analysis-section-groups";
import { ScenarioComparison } from "./scenario-comparison";
import { extractValuationSummary } from "../lib/valuation-summary";
import { BackButton, Badge, DisclosureSurface, MetadataGrid, SecondaryBlock } from "./ui-primitives";

type AnalysisDoc = CompanyDocument | ResearchDocument;

function inline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|__.*?__|~~.*?~~|(?<!\*)\*[^*]+\*(?!\*)|`.*?`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <del key={index}>{part.slice(2, -2)}</del>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return (
        <a href={link[2]} target="_blank" rel="noreferrer" key={index}>
          {link[1]}
        </a>
      );
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
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

function DecisionTemplate({ decision, isDemo }: { decision: DecisionFields; isDemo: boolean }) {
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
    <SecondaryBlock as="section" className="decision-template">
      <div className="decision-template-head">
        <div>
          <p className="eyebrow">Decision Card</p>
          <h2>Cadre de décision</h2>
        </div>
        <span className="decision-template-badge">{isDemo ? "Document démo structuré" : "Notion · structuré"}</span>
      </div>
      <MetadataGrid
        className="decision-facts"
        items={keys.map((key) => ({
          label: decisionLabels[key],
          value: decisionValue(key, decision[key]),
        }))}
      />
      {blocks.map(([label, value]) => (
        <SecondaryBlock className="decision-template-block" key={label}>
          <small>{label}</small>
          <p>{value}</p>
        </SecondaryBlock>
      ))}
      {riskBlocks.length > 0 && (
        <div className="decision-template-columns">
          {riskBlocks.map(([label, value]) => (
            <SecondaryBlock key={label}>
              <small>{label}</small>
              <p>{value}</p>
            </SecondaryBlock>
          ))}
        </div>
      )}
    </SecondaryBlock>
  );
}

export function AnalysisReader({ document, companyName, onBack, embedded = false }: { document: AnalysisDoc; companyName: string; onBack?: () => void; embedded?: boolean }) {
  if (document.sourceKey === "analyses" && (document.category === "synthese" || /investment memo|mémo cio/i.test(`${document.agent} ${document.title}`))) {
    return <InvestmentMemoReader document={document} companyName={companyName} onBack={onBack} embedded={embedded} />;
  }
  return <StandardAnalysisReader document={document} companyName={companyName} onBack={onBack} embedded={embedded}/>;
}

function StandardAnalysisReader({ document, companyName, onBack, embedded }: { document: AnalysisDoc; companyName: string; onBack?: () => void; embedded: boolean }) {
  const isDemo = document.id.startsWith("demo-");
  const blocks = React.useMemo(() => parseNotionDocument(document.plainText, document.title, document.notionBlocks), [document]);
  const presentation = documentPresentation(blocks, document.summary ?? "", { category: document.category, handoffSummary: document.handoffSummary });
  const scenarioSummary = document.category === "valuation" ? extractValuationSummary(blocks) : null;
  const hidden = new Set(presentation.hiddenIndexes);
  if (scenarioSummary) hidePromotedTableSections(blocks, scenarioSummary.promotedBlockIndexes, hidden);
  const headings = blocks.flatMap((block, index) => block.type === "heading" && block.level <= 2 && !hidden.has(index) ? [{ text: block.text, index }] : []);
  const templateKind = document.category || (document.sourceKey === "decisions" ? "synthese" : "universal");
  const scored = templateKind === "business" || templateKind === "valuation";
  const outcome = document.verdict
    ? { label: document.sourceKey === "decisions" ? "Décision" : "Verdict", value: document.verdict, detail: scored && document.score ? document.score : undefined }
    : scored && document.score
      ? { label: "Score", value: document.score }
      : null;
  const metadata = [
    { label: "Agent", value: document.agent },
    { label: "Statut", value: document.status || "Importé" },
    ...(scored ? [{ label: "Score", value: document.score || "—" }] : []),
    {
      label: "Mise à jour",
      value: shortDate(document.date || document.lastEditedTime),
    },
  ];
  return (
    <section className="research-reader universal-analysis-reader" data-analysis-template={templateKind}>
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
        title={document.title}
        subtitle={<>{companyName} · {shortDate(document.date || document.lastEditedTime)}</>}
        outcome={outcome}
      />
      <div className="notion-layout universal-analysis-layout">
        <article className="notion-page universal-analysis-page">
          {presentation.summaryItems.length > 0 && (
            <SecondaryBlock className="analysis-lead">
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
            </SecondaryBlock>
          )}
          {presentation.facts.length > 0 && (
            <AnalysisFactGrid
              ariaLabel="Repères du document"
              category={templateKind}
              facts={presentation.facts}
              renderValue={inline}
            />
          )}
          <MetadataGrid ariaLabel="Métadonnées de l’analyse" items={metadata} />
          {scenarioSummary && <ScenarioComparison summary={scenarioSummary} showThresholds />}
          <DisclosureSurface
            className="analysis-source-details"
            summary={
              <>
                <span>
                  <strong>Document source et sommaire</strong>
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
                    <a href={`#analysis-heading-${heading.index}`} onClick={event => { event.preventDefault(); window.document.getElementById(`analysis-heading-${heading.index}`)?.scrollIntoView({ block: "start" }); }} key={heading.index}>
                      {heading.text}
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
          {document.sourceKey === "decisions" && document.decision && <DecisionTemplate decision={document.decision} isDemo={isDemo} />}
          <AnalysisSectionGroups blocks={blocks} hidden={hidden} idForHeading={index => `analysis-heading-${index}`} classForHeading={title => { const scenario = scenarioKind(title); return scenario ? `analysis-scenario analysis-scenario-${scenario}` : ""; }} renderBlock={({ block, index }) => {
            if (block.type === "heading") {
              const Tag = `h${Math.min(block.level + 1, 6)}` as keyof React.JSX.IntrinsicElements;
              return <section className="analysis-section"><Tag>{inline(block.text)}</Tag></section>;
            }
            if (block.type === "paragraph") return <p key={index}>{inline(block.text)}</p>;
            if (block.type === "quote") return <blockquote key={index}>{inline(block.text)}</blockquote>;
            if (block.type === "callout")
              return (
                <SecondaryBlock className="notion-callout" key={index}>
                  <span>◆</span>
                  <p>{inline(block.text)}</p>
                </SecondaryBlock>
              );
            if (block.type === "divider") return <hr key={index} />;
            if (block.type === "list") {
              const Tag = block.ordered ? "ol" : "ul";
              return (
                <Tag key={index}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{inline(item)}</li>
                  ))}
                </Tag>
              );
            }
            return <NotionTable key={index} rows={block.rows} header={block.header ?? true} renderCell={inline} />;
          }} />
          <footer className="notion-page-footer">
            <span>{isDemo ? "Fin du document de démonstration" : "Fin du document synchronisé"}</span>
            {!isDemo && <a href={document.notionUrl} target="_blank" rel="noreferrer">Comparer avec Notion ↗</a>}
          </footer>
        </article>
      </div>
    </section>
  );
}
