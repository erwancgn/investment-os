"use client";

import React from "react";
import type { CompanyDocument, ResearchDocument } from "../lib/investment-data";
import { documentPresentation } from "../lib/document-presentation";
import { compactDecisionLabel } from "../lib/decision-label";
import { parseNotionDocument, type RenderBlock } from "../lib/notion-renderer";
import { NotionTable } from "./notion-table";
import { AnalysisFactGrid, AnalysisReportHero } from "./analysis-presentation";
import { AnalysisSectionGroups } from "./analysis-section-groups";
import { ScenarioComparison } from "./scenario-comparison";
import { extractValuationSummary } from "../lib/valuation-summary";
import {
  BackButton,
  Badge,
  DisclosureSurface,
  PrimaryBlock,
  SecondaryBlock,
} from "./ui-primitives";

type MemoDocument = CompanyDocument | ResearchDocument;

function inline(text: string) {
  const parts = text
    .split(/(\*\*.*?\*\*|__.*?__|~~.*?~~|`.*?`|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean);
  return parts.map((part, index) => {
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    )
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~"))
      return <del key={index}>{part.slice(2, -2)}</del>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={index}>{part.slice(1, -1)}</code>;
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

function sectionRange(blocks: RenderBlock[], pattern: RegExp) {
  const start = blocks.findIndex(
    (block) => block.type === "heading" && pattern.test(block.text),
  );
  if (start < 0) return null;
  const level = blocks[start].type === "heading" ? blocks[start].level : 1;
  const offset = blocks
    .slice(start + 1)
    .findIndex((block) => block.type === "heading" && block.level <= level);
  return { start, end: offset < 0 ? blocks.length : start + 1 + offset };
}

function firstTable(
  blocks: RenderBlock[],
  range: { start: number; end: number } | null,
) {
  if (!range) return null;
  return (
    blocks
      .slice(range.start + 1, range.end)
      .find(
        (block): block is Extract<RenderBlock, { type: "table" }> =>
          block.type === "table",
      ) ?? null
  );
}

function twoColumnFacts(table: Extract<RenderBlock, { type: "table" }> | null) {
  if (!table) return [];
  const rows = table.header ? table.rows.slice(1) : table.rows;
  return rows
    .filter((row) => row.length >= 2)
    .map((row) => ({
      label: row[0]?.trim(),
      value: row.slice(1).join(" · ").trim(),
    }))
    .filter(
      (item) =>
        item.label &&
        item.value &&
        !/^(?:score|note)(?:\s|$)/i.test(item.label),
    );
}

function blockText(block: RenderBlock) {
  if (block.type === "list") return block.items.join(" ");
  return "text" in block ? block.text : "";
}

function MemoBlock({ block, index }: { block: RenderBlock; index: number }) {
  if (block.type === "heading") {
    const Tag =
      `h${Math.min(block.level + 1, 6)}` as keyof React.JSX.IntrinsicElements;
    return (
      <section className="analysis-section memo-section-heading">
        <Tag id={`memo-heading-${index}`}>{inline(block.text)}</Tag>
      </section>
    );
  }
  if (block.type === "paragraph") return <p>{inline(block.text)}</p>;
  if (block.type === "quote")
    return <blockquote>{inline(block.text)}</blockquote>;
  if (block.type === "callout")
    return (
      <SecondaryBlock className="notion-callout">
        <span>{block.icon || "◆"}</span>
        <p>{inline(block.text)}</p>
      </SecondaryBlock>
    );
  if (block.type === "divider") return <hr />;
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{inline(item)}</li>
        ))}
      </Tag>
    );
  }
  return (
    <NotionTable
      rows={block.rows}
      header={block.header ?? true}
      renderCell={inline}
    />
  );
}

export function InvestmentMemoReader({
  document,
  companyName,
  onBack,
}: {
  document: MemoDocument;
  companyName: string;
  onBack: () => void;
}) {
  const isDemo = document.id.startsWith("demo-");
  const [openedAt] = React.useState(() => Date.now());
  const blocks = React.useMemo(() => parseNotionDocument(
    document.plainText,
    document.title,
    document.notionBlocks,
  ), [document]);
  const presentation = documentPresentation(blocks, document.summary ?? "", { category: document.category, handoffSummary: document.handoffSummary });
  const scenarioSummary = extractValuationSummary(blocks);
  const decisionRange = sectionRange(blocks, /decision card/i);
  const modulesRange = sectionRange(
    blocks,
    /handoffs disponibles|état des modules|modules disponibles/i,
  );
  const reasoningRange = sectionRange(blocks, /raisonnement décisif/i);
  const decisionFacts = twoColumnFacts(firstTable(blocks, decisionRange));
  const modulesTable = firstTable(blocks, modulesRange);
  const reasoning = reasoningRange
    ? blocks
        .slice(reasoningRange.start + 1, reasoningRange.end)
        .map(blockText)
        .filter(Boolean)
    : [];
  const hidden = new Set(presentation.hiddenIndexes);
  for (const range of [decisionRange, reasoningRange]) {
    if (range)
      for (let index = range.start; index < range.end; index++)
        hidden.add(index);
  }
  const memoDate = document.date || document.lastEditedTime;
  const ageDays = memoDate
    ? Math.floor((openedAt - new Date(memoDate).getTime()) / 86_400_000)
    : null;
  const stale = ageDays != null && ageDays > 45;
  const decisionLabel = document.verdict ? compactDecisionLabel(document.verdict) : "À statuer";

  return (
    <section
      className="research-reader universal-analysis-reader investment-memo-reader"
      data-analysis-template="memo"
    >
      <div className="detail-navigation">
        <BackButton onBack={onBack} ariaLabel="Retour à la fiche entreprise" />
      </div>
      <AnalysisReportHero
        className="memo-hero"
        badges={
          <>
            <Badge>Investment Memo CIO</Badge>
            {document.current && <Badge tone="positive">Current</Badge>}
            <Badge tone={stale ? "warning" : "positive"}>
              {stale ? "À actualiser" : document.status || "Disponible"}
            </Badge>
          </>
        }
        title={companyName}
        subtitle={<>{document.title} · {shortDate(memoDate)}</>}
        outcome={{
          label: "Décision CIO",
          value: document.verdict || "À statuer",
          detail: stale ? `Mémo daté de ${ageDays} jours` : "Synthèse décisionnelle",
        }}
      />

      <div className="notion-layout universal-analysis-layout">
        <PrimaryBlock
          as="article"
          className="notion-page universal-analysis-page memo-page"
        >
          {presentation.summaryItems.length > 0 && (
            <SecondaryBlock className="analysis-lead memo-tldr">
              <section aria-labelledby="memo-tldr">
                <span id="memo-tldr">TL;DR</span>
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
                renderValue={inline}
              />
            ) : (
              <p className="generic-empty">
                La Decision Card n’est pas structurée dans ce mémo.
              </p>
            )}
          </section>

          {reasoning.length > 0 && (
            <SecondaryBlock className="memo-reasoning">
              <small>Raisonnement décisif</small>
              {reasoning.map((text, index) => (
                <p key={index}>{inline(text)}</p>
              ))}
            </SecondaryBlock>
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
                renderCell={inline}
              />
            </DisclosureSurface>
          )}

          <nav className="memo-quick-nav" aria-label="Repères du Mémo CIO">
            {blocks.map((block, index) =>
              block.type === "heading" &&
              block.level <= 2 &&
              !hidden.has(index) ? (
                <a key={index} href={`#memo-heading-${index}`}>
                  {block.text}
                </a>
              ) : null,
            )}
          </nav>

          <AnalysisSectionGroups blocks={blocks} hidden={hidden} idForHeading={index => `memo-heading-${index}`} renderBlock={({ block, index }) => <MemoBlock block={block} index={index} />} />

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
        </PrimaryBlock>
      </div>
    </section>
  );
}
