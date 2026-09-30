import { parseNotionDocument, canonicalAnalysisContent, type RenderBlock } from "./notion-renderer.ts";
import { plainInlineText } from "./inline-segments.ts";
import { SCHEMA_VERSION, isIsoDateTime, isIsoDateOrDateTime, isSafeHttpUrl, type Diagnostic, type Provenance } from "../../core/contracts/common.ts";
import { isAnalysis, type Analysis, type AnalysisFamily, type AnalysisPresentation, type AnalysisMetric, type AnalysisBlock } from "../../core/contracts/analysis.ts";
import { validatePresentationProjection } from "../../core/contracts/presentation-projection.ts";
import type { CompanyDocument } from "./investment-data";
import { extractValuationSummary } from "./valuation-summary.ts";

export type PresentationFact = { label: string; value: string };
type PresentationOptions = { category?: string; handoffSummary?: string | null };

const priorityFactPatterns: Record<string, RegExp> = {
  earnings: /^(?:résultats? clés?|guidance)$/i,
  business: /^(?:croissance|marges?|moat|allocation du capital)$/i,
  valuation: /^(?:cours de référence|prix de référence|fair value|valeur intrinsèque|potentiel|upside)$/i,
  risques: /^(?:risque principal|probabilité|invalidation|trigger|déclencheur(?: de revue)?)$/i,
  portfolio: /^(?:poids actuel|poids cible|poids maximal|plafond|source de financement)$/i,
  memo: /^(?:décision|sizing|taille initiale|cible|plafond|condition)$/i,
};

function normalizedPresentationKind(category: string) {
  if (category === "short") return "risques";
  if (category === "investment_memo" || category === "synthese") return "memo";
  return category;
}

export function isPriorityPresentationFact(category: string, label: string) {
  return priorityFactPatterns[normalizedPresentationKind(category)]?.test(label.trim()) ?? false;
}

export function splitPresentationFactValue(value: string) {
  const segments = value.split(/\s*;\s*|\n+/).map(segment => segment.trim()).filter(Boolean);
  return segments.length ? segments : [value];
}

const summaryHeadingPattern = /^(?:tl\s*;?\s*dr|à retenir|executive summary|synthèse)\b/i;
const factLabels = [
  "Date du snapshot", "Date d’analyse", "Date de l’analyse", "Ticker", "Place de cotation", "Secteur",
  "Dernier exercice analysé", "Dernier trimestre analysé", "Refresh", "Source earnings",
  "Devise de référence", "Devise", "Valeur totale du portefeuille",
  "Cash disponible", "Business Check disponible", "Valuation Check disponible", "Short Check disponible",
  "Verdict standalone", "Verdict portefeuille", "Verdict", "Exposition déjà présente", "Impact sur concentration",
  "Poids initial", "Poids cible", "Poids maximal", "Source de financement", "Priorité", "Décision",
  "Cours de référence", "Prix de référence", "Période financière", "Signal", "Statut",
];

export function isSummaryHeading(text: string) {
  return summaryHeadingPattern.test(plainInlineText(text).trim());
}

function blockText(block: RenderBlock): string[] {
  if (block.type === "list") return block.items;
  if ("text" in block && block.text.trim()) return [block.text.trim()];
  return [];
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const technicalSummaryPattern = /(?:^|;)\s*(?:contract_version|run_id|module|final_decision|initial|target|ceiling)\s*=/i;

function cioHandoffItems(value: string) {
  const fields = new Map<string, string>();
  value.split(";").forEach(part => {
    const separator = part.indexOf("=");
    if (separator < 1) return;
    fields.set(part.slice(0, separator).trim().toLowerCase(), compact(part.slice(separator + 1)));
  });
  const localized = (field: string) => field
    .replace(/\bshare\b/gi, "action")
    .replace(/\beconomic\b/gi, "économique")
    .replace(/\bcurrent valuation remains\b/gi, "la valorisation actuelle reste")
    .replace(/\bpreserve\b/gi, "conserver")
    .replace(/\bcash\b/gi, "de liquidités");
  const items: string[] = [];
  const decision = fields.get("final_decision");
  const confidence = fields.get("confidence");
  if (decision) items.push(`Décision CIO : ${localized(decision)}${confidence ? ` · confiance ${localized(confidence)}` : ""}.`);
  const modules = [
    fields.get("business") ? `Business ${localized(fields.get("business")!)}` : "",
    fields.get("valuation") ? `valorisation ${localized(fields.get("valuation")!)}` : "",
    fields.get("short") ? `risque baissier ${localized(fields.get("short")!)}` : "",
  ].filter(Boolean);
  if (modules.length) items.push(`${modules.join(" · ")}.`);
  const sizing = [
    fields.get("initial") ? `taille initiale ${localized(fields.get("initial")!)}` : "",
    fields.get("target") ? `cible ${localized(fields.get("target")!)}` : "",
    fields.get("ceiling") ? `plafond ${localized(fields.get("ceiling")!)}` : "",
  ].filter(Boolean);
  const condition = fields.get("condition");
  if (sizing.length || condition) items.push(`${sizing.join(" · ")}${sizing.length && condition ? ". Condition : " : ""}${condition ? localized(condition) : ""}.`);
  return items;
}

export function visibleSummaryItems(items: string[]) {
  const sentenceSegmenter = new Intl.Segmenter("fr", { granularity: "sentence" });
  return items
    .filter((item) => !/^run(?:\s*id)?\s*[:#—–-]?\s*[A-Z0-9][A-Z0-9._-]*\.?\s*$/i.test(compact(item)))
    .flatMap(item => {
      const protectedAbbreviations: string[] = [];
      const protectedText = compact(item).replace(/\b(Mme\.|Mlle\.|M\.|Dr\.|Pr\.|etc\.|ex\.|p\.\s?ex\.)/gi, value => {
        const index = protectedAbbreviations.push(value) - 1;
        return `\uE000${index}\uE001`;
      });
      return [...sentenceSegmenter.segment(protectedText)]
        .map(sentence => sentence.segment.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedAbbreviations[Number(index)]).trim())
        .filter(Boolean);
    });
}

/** Hide promoted source tables and headings that would otherwise become empty sections. */
export function hidePromotedTableSections(blocks: RenderBlock[], promotedIndexes: number[], hiddenIndexes: Set<number>) {
  for (const index of promotedIndexes) {
    hiddenIndexes.add(index);
    let headingIndex = -1;
    for (let cursor = index - 1; cursor >= 0; cursor--) {
      const candidate = blocks[cursor];
      if (candidate.type === "heading" && candidate.level <= 2) {
        headingIndex = cursor;
        break;
      }
    }
    if (headingIndex < 0) continue;
    const nextHeading = blocks.findIndex((block, cursor) => cursor > headingIndex && block.type === "heading" && block.level <= 2);
    const end = nextHeading < 0 ? blocks.length : nextHeading;
    const remainingContent = blocks.slice(headingIndex + 1, end)
      .some((_block, offset) => headingIndex + 1 + offset !== index && !hiddenIndexes.has(headingIndex + 1 + offset));
    if (!remainingContent) hiddenIndexes.add(headingIndex);
  }
  return hiddenIndexes;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function factsFromText(text: string): PresentationFact[] {
  const normalized = compact(text).replace(/\*\*([^*]+?)\*\*/g, "$1").replace(/__([^_]+?)__/g, "$1");
  if (!normalized) return [];
  const labels = [...factLabels].sort((a, b) => b.length - a.length);
  const labelPattern = labels.map(escapeRegExp).join("|");
  const matcher = new RegExp(`(?:^|\\s)(?<label>${labelPattern})\\s*:\\s*(?<value>.*?)(?=\\s(?:${labelPattern})\\s*:|$)`, "giu");
  const facts: PresentationFact[] = [];
  for (const match of normalized.matchAll(matcher)) {
    const label = compact(match.groups?.label ?? "");
    const value = compact(match.groups?.value ?? "").replace(/\s+(?:TL\s*;?\s*DR|À retenir)$/i, "");
    if (label && value && value.length <= 180) facts.push({ label, value });
  }
  return facts;
}

function factsFromTable(block: Extract<RenderBlock, { type: "table" }>): PresentationFact[] {
  if (!block.rows.length || block.rows.some(row => row.length !== 2)) return [];
  const rows = block.header ? block.rows.slice(1) : block.rows;
  return rows.map(row => ({ label: compact(row[0] ?? ""), value: compact(row[1] ?? "") }))
    .filter(fact => fact.label && fact.value && fact.label.length <= 80 && fact.value.length <= 180);
}

export function documentPresentation(blocks: RenderBlock[], propertySummary: string | null = "", options: PresentationOptions = {}) {
  propertySummary = propertySummary ?? "";
  const summaryHeadingIndex = blocks.findIndex(block => block.type === "heading" && isSummaryHeading(block.text));
  const nextHeadingOffset = summaryHeadingIndex < 0 ? -1 : blocks.slice(summaryHeadingIndex + 1).findIndex(block => block.type === "heading");
  const summaryEndIndex = summaryHeadingIndex < 0 ? -1 : nextHeadingOffset < 0 ? blocks.length : summaryHeadingIndex + 1 + nextHeadingOffset;
  const explicitSummaryBlocks = summaryHeadingIndex < 0 ? [] : blocks.slice(summaryHeadingIndex + 1, summaryEndIndex)
    .filter(block => block.type === "paragraph" || block.type === "callout" || block.type === "quote" || block.type === "list");

  const firstHeadingIndex = blocks.findIndex(block => block.type === "heading");
  const introEnd = firstHeadingIndex < 0 ? Math.min(blocks.length, 8) : firstHeadingIndex;
  const introBlocks = blocks.slice(0, introEnd).filter(block => block.type === "paragraph" || block.type === "callout" || block.type === "quote" || block.type === "list");
  const fallbackBlock = introBlocks.find(block => blockText(block).join(" ").length >= 35);
  const summaryItems = visibleSummaryItems(explicitSummaryBlocks.flatMap(blockText).filter(Boolean));
  const isCioMemo = options.category === "synthese";
  const technicalPropertySummary = isCioMemo && technicalSummaryPattern.test(propertySummary);
  if (!summaryItems.length && isCioMemo && fallbackBlock) summaryItems.push(...visibleSummaryItems(blockText(fallbackBlock)));
  if (!summaryItems.length && propertySummary.trim() && !technicalPropertySummary) summaryItems.push(...visibleSummaryItems([compact(propertySummary)]));
  if (!summaryItems.length && fallbackBlock) summaryItems.push(...visibleSummaryItems(blockText(fallbackBlock)));
  if (!summaryItems.length && isCioMemo) summaryItems.push(...cioHandoffItems(options.handoffSummary || (technicalPropertySummary ? propertySummary : "")));

  const factScope = summaryHeadingIndex >= 0 ? blocks.slice(0, summaryHeadingIndex) : blocks.slice(0, 10);
  const facts = factScope.flatMap(block => block.type === "table" ? factsFromTable(block) : blockText(block).flatMap(factsFromText));
  const uniqueFacts = [...new Map(facts.map(fact => [fact.label.toLocaleLowerCase("fr-FR"), fact])).values()].slice(0, 6);

  const hiddenIndexes = new Set<number>();
  if (summaryHeadingIndex >= 0) {
    explicitSummaryBlocks.forEach(block => hiddenIndexes.add(blocks.indexOf(block)));
    if (blocks.slice(summaryHeadingIndex + 1, summaryEndIndex).every(block => hiddenIndexes.has(blocks.indexOf(block)))) hiddenIndexes.add(summaryHeadingIndex);
  }
  else if (fallbackBlock) {
    const fallbackIndex = blocks.indexOf(fallbackBlock);
    if (fallbackIndex >= 0) hiddenIndexes.add(fallbackIndex);
  }

  // Run Receipt is parser/debug metadata, not reader-facing analysis. Hide its
  // whole heading range at presentation time; the persisted source stays intact.
  blocks.forEach((block, index) => {
    if (block.type !== "heading" || !/^run\s*receipt$/i.test(compact(block.text).replace(/^\d+[.)\s-]+/, "").replace(/[:：]$/, ""))) return;
    hiddenIndexes.add(index);
    for (let next = index + 1; next < blocks.length; next++) {
      const candidate = blocks[next];
      if (candidate.type === "heading" && candidate.level <= block.level) break;
      hiddenIndexes.add(next);
    }
  });

  // A number of Notion templates start with a compact metadata paragraph
  // (date, ticker, currency, period…). Once those values are promoted to the
  // fact grid, keeping the raw paragraph would duplicate them as an
  // unreadable wall of text on mobile.
  factScope.forEach(block => {
    if (block.type === "heading" || block.type === "table") return;
    const extractedFacts = blockText(block).flatMap(factsFromText);
    const allPromoted = extractedFacts.every(fact => uniqueFacts.some(promoted => promoted.label === fact.label && promoted.value === fact.value));
    let remaining = compact(blockText(block).join(" ")).replace(/\*\*([^*]+?)\*\*/g, "$1").replace(/__([^_]+?)__/g, "$1");
    extractedFacts.forEach(fact => { remaining = remaining.replace(new RegExp(`${escapeRegExp(fact.label)}\\s*:\\s*${escapeRegExp(fact.value)}`, "i"), ""); });
    if (extractedFacts.length >= 2 && allPromoted && !remaining.replace(/[\s.;|·—–-]/g, "")) {
      const index = blocks.indexOf(block);
      if (index >= 0) hiddenIndexes.add(index);
    }
  });

  return { summaryItems, facts: uniqueFacts, hiddenIndexes };
}

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

export type NormalizedAnalysisDocument = {
  analysis: Analysis;
  view: Omit<ReturnType<typeof documentPresentation>, "hiddenIndexes"> & { hiddenIndexes: number[]; factGroups: { start: number; end: number; facts: { label: string; value: string; index: number }[] }[] };
  valuation: ReturnType<typeof extractValuationSummary> | null;
  memo: { decisionFacts: PresentationFact[]; modulesTable: Extract<AnalysisBlock, { type: "table" }> | null; reasoning: AnalysisBlock[]; hiddenIndexes: number[] };
};

/** The single raw-document boundary shared by server readers and compact previews. */
export function normalizeAnalysisDocument(document: CompanyDocument): NormalizedAnalysisDocument {
  const blocks = parseNotionDocument(document.plainText, document.title, document.notionBlocks);
  const content = canonicalAnalysisContent(document.id, blocks);
  const diagnostics: Diagnostic[] = content.blocks.filter(block => block.type === "unsupported").map(block => block.diagnostic);
  const lastEditedTime = isIsoDateTime(document.lastEditedTime) ? document.lastEditedTime : "1970-01-01T00:00:00Z";
  const date = document.date == null ? null : isIsoDateOrDateTime(document.date) ? document.date : null;
  if (lastEditedTime !== document.lastEditedTime || date !== document.date) diagnostics.push({ code: "invalid_source_date", severity: "warning", message: "Date source invalide : valeur originale conservée dans le document importé, fraîcheur inconnue." });
  const family: AnalysisFamily = document.sourceKey === "decisions" ? "decision" : ({
    business: "business", valuation: "valuation", risques: "short", portfolio: "portfolio",
    synthese: "cio_memo", earnings: "earnings", analyses: "generic",
  } as Record<string, AnalysisFamily>)[document.category] ?? "unknown";
  const projectionFamily = ({ business: "business", valuation: "valuation", short: "short", portfolio: "portfolio", cio_memo: "cio", earnings: "earnings" } as Record<string, string>)[family];
  const projection = document.presentationStatus === "valid" && document.presentationProjection
    && document.presentationProjection.analysisType === projectionFamily && validatePresentationProjection(document.presentationProjection)
    ? { status: "valid" as const, projection: document.presentationProjection }
    : document.presentationStatus === "invalid" || document.presentationStatus === "valid"
      ? { status: "invalid" as const, diagnostic: { code: "invalid_projection", message: document.presentationError || "Projection invalide.", severity: "warning" as const } }
      : { status: "absent" as const };
  const extractedView = documentPresentation(blocks, document.summary ?? "", { category: document.category, handoffSummary: document.handoffSummary ?? null });
  const factGroups: NormalizedAnalysisDocument["view"]["factGroups"] = [];
  for (let index = 0; index < blocks.length;) {
    const start = index;
    const facts: { label: string; value: string; index: number }[] = [];
    while (index < blocks.length && blocks[index].type === "paragraph") {
      const block = blocks[index] as Extract<RenderBlock, { type: "paragraph" }>;
      const match = block.text.match(/^(?:\*\*|__)?([^:：\n]{2,48}?)(?:\*\*|__)?\s*[:：]\s*(\S[\s\S]{0,159})$/);
      if (!match) break;
      facts.push({ label: match[1].trim(), value: match[2].trim(), index });
      index++;
    }
    if (facts.length >= 3) factGroups.push({ start, end: index, facts });
    if (index === start) index++;
  }
  const view = { ...extractedView, hiddenIndexes: [...extractedView.hiddenIndexes], factGroups };
  if (projection.status === "valid") view.summaryItems = visibleSummaryItems([projection.projection.summary.text]);
  if (projection.status === "invalid") diagnostics.push(projection.diagnostic);
  const valuation = family === "valuation" || family === "cio_memo" ? extractValuationSummary(blocks) : null;
  const provenance: Provenance = { kind: document.id.startsWith("demo-") ? "legacy" : "notion", sourceId: document.id, revision: document.lastEditedTime || null, capturedAt: isIsoDateTime(document.lastEditedTime) ? document.lastEditedTime : null };
  const blockIds = content.blocks.map(block => block.id);
  const findBlock = (label: string, value: string) => {
    const contains = (text: string, part: string) => compact(plainInlineText(text)).includes(compact(plainInlineText(part)));
    const index = blocks.findIndex(block => block.type !== "divider" && (block.type === "table"
      ? block.rows.some(row => row.some(cell => contains(cell, label)) && row.some(cell => contains(cell, value)))
      : block.type === "list" ? block.items.some(item => contains(item, label) && contains(item, value))
        : "text" in block && contains(block.text, label) && contains(block.text, value)));
    return index < 0 ? [] : [blockIds[index]];
  };
  const projectionProvenance: Provenance = projection.status === "valid"
    ? { kind: "projection", sourceId: document.id, revision: document.lastEditedTime || null, capturedAt: projection.projection.generatedAt }
    : provenance;
  const metric = (source: { id: string; label: string; value: number | null; unit: string; status: "known" | "unknown"; asOf: string | null }): AnalysisMetric => ({
    id: source.id, label: source.label, value: source.value, unit: source.unit, status: source.status, asOf: source.asOf, sourceBlockIds: [], provenance: projectionProvenance,
  });
  const legacyMetric = (id: string, label: string, raw: string | undefined, sourceBlockIds: string[], unit: string | null): AnalysisMetric | null => {
    if (!raw) return null;
    const token = raw.match(/[-−+]?\s*\d[\d\s.,'’]*/)?.[0]?.trim();
    if (!token) return null;
    let number = token.replace(/[\s'’]/g, "").replace("−", "-");
    if (number.includes(",") && number.includes(".")) number = number.lastIndexOf(",") > number.lastIndexOf(".") ? number.replace(/\./g, "").replace(",", ".") : number.replace(/,/g, "");
    else if (unit !== "%" && unit !== "years" && /^[+-]?\d{1,3}(?:[.,]\d{3})+$/.test(number)) number = number.replace(/[.,]/g, "");
    else number = number.replace(",", ".");
    const value = Number(number);
    if (!Number.isFinite(value)) return null;
    return { id, label, value, unit, status: "known", asOf: null, sourceBlockIds, provenance };
  };
  const currency = (raw: string) => raw.match(/USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥]/i)?.[0] ?? null;
  const presentation: AnalysisPresentation = projection.status === "valid" ? {
    facts: projection.projection.facts.map(fact => ({ id: fact.id, label: fact.label, value: fact.value, unit: fact.unit, status: fact.status, asOf: fact.asOf, sourceBlockIds: [], provenance: projectionProvenance })),
    thresholds: projection.projection.thresholds.map(metric),
    scenarios: projection.projection.scenarios.map(scenario => ({
      id: scenario.id, label: scenario.label, condition: scenario.status === "known" ? scenario.condition : null,
      impact: scenario.status === "known" ? scenario.impact : null, status: scenario.status, asOf: scenario.asOf,
      sourceBlockIds: [], provenance: projectionProvenance,
      terminalValue: scenario.terminalValue ? metric(scenario.terminalValue) : null,
      cagrPercent: scenario.cagrPercent ? metric(scenario.cagrPercent) : null,
      horizon: scenario.horizon ? metric(scenario.horizon) : null,
    })),
  } : {
    facts: view.facts.flatMap((fact, index) => {
      const sourceBlockIds = findBlock(fact.label, fact.value);
      return sourceBlockIds.length ? [{ id: `fact:${index}`, label: fact.label, value: fact.value, unit: null, status: "known" as const, asOf: null, sourceBlockIds, provenance }] : [];
    }),
    thresholds: valuation?.thresholds.flatMap((threshold, index) => {
      const sourceBlockIds = threshold.sourceBlockIndexes.map(blockIndex => blockIds[blockIndex]).filter(Boolean);
      const value = legacyMetric(`threshold:${index}`, `Prix maximal pour ${threshold.rate}`, threshold.price, sourceBlockIds, currency(threshold.price));
      return value ? [value] : [];
    }) ?? [],
    scenarios: valuation?.scenarios.flatMap((scenario, index) => {
      const sourceBlockIds = scenario.sourceBlockIndexes.map(blockIndex => blockIds[blockIndex]).filter(Boolean);
      return sourceBlockIds.length && (scenario.terminal || scenario.cagr)
        ? [{ id: `scenario:${index}`, label: scenario.name, condition: scenario.name, impact: [scenario.terminal, scenario.cagr].filter(Boolean).join(" · "), status: "known" as const, asOf: null, sourceBlockIds, provenance, terminalValue: legacyMetric(`scenario:${index}:terminal`, scenario.terminalLabel ?? "Prix terminal", scenario.terminal, sourceBlockIds, currency(scenario.terminal ?? "")), cagrPercent: legacyMetric(`scenario:${index}:cagr`, "CAGR actionnaire", scenario.cagr, sourceBlockIds, "%"), horizon: legacyMetric(`scenario:${index}:horizon`, "Horizon", valuation?.horizon ?? undefined, sourceBlockIds, "years") }]
        : [];
    }) ?? [],
  };
  if (projection.status !== "valid" && valuation && (family === "valuation" || (family === "cio_memo" && valuation.scenarios.length === 3 && valuation.scenarios.every(scenario => scenario.terminal && scenario.cagr)))) {
    view.hiddenIndexes = [...hidePromotedTableSections(blocks, valuation.promotedBlockIndexes, new Set(view.hiddenIndexes))];
  }
  if (projection.status === "valid") view.hiddenIndexes = [];
  const header = {
    schemaVersion: SCHEMA_VERSION, id: document.id, title: document.title || "Analyse", sourceUrl: isSafeHttpUrl(document.notionUrl) ? document.notionUrl : null,
    family, originalFamily: family === "unknown" ? document.category || document.agent || "unknown" : null, sourceKind: document.sourceKey === "decisions" ? "decision" as const : "analysis" as const,
    agent: document.agent || null, status: document.status || "Snapshot Notion", date,
    lastEditedTime, companyIds: [...new Set((document.relations ?? []).filter(relation => relation.sourceKey === "companies").map(relation => relation.id))], revision: document.lastEditedTime || "unknown",
    sourceFreshness: "unknown" as const, archived: document.archived ?? false, provenance,
  };
  const base = { schemaVersion: SCHEMA_VERSION, kind: family, header, content,
    summary: projection.status === "valid" ? projection.projection.summary.text : view.summaryItems.join("\n") || null,
    verdict: document.verdict || null, confidence: document.confidence ?? null, presentation, projection,
    diagnostics,
  };
  const decision = {
    schemaVersion: SCHEMA_VERSION, action: null, outcome: null, account: null, instrumentType: null,
    currentWeight: null, maximumWeight: null, maximumEntryPrice: null, nextReview: null,
    confidence: null, coreThesis: null, entryCondition: null, executionPlan: null,
    fundingSource: null, catalyst: null, invalidationCriteria: null, keyRisk: null, reviewTrigger: null,
    ...document.decision,
  };
  let analysis: Analysis;
  switch (family) {
    case "business": analysis = { ...base, kind: family, header: { ...header, family }, score: document.score || null }; break;
    case "valuation": analysis = { ...base, kind: family, header: { ...header, family }, score: document.score || null }; break;
    case "short": analysis = { ...base, kind: family, header: { ...header, family } }; break;
    case "portfolio": analysis = { ...base, kind: family, header: { ...header, family } }; break;
    case "cio_memo": analysis = { ...base, kind: family, header: { ...header, family }, handoffSummary: document.handoffSummary ?? null }; break;
    case "decision": analysis = { ...base, kind: family, header: { ...header, family }, decision }; break;
    case "earnings": analysis = { ...base, kind: family, header: { ...header, family }, earningsReview: document.earningsReview ?? { fiscalPeriod: null, guidance: null, guidanceVsConsensus: null, confidence: null, refreshes: [] } }; break;
    default: analysis = { ...base, kind: family as "generic" | "unknown", header: { ...header, family: family as "generic" | "unknown" } }; break;
  }
  const decisionRange = family === "cio_memo" ? sectionRange(blocks, /decision card/i) : null;
  const reasoningRange = family === "cio_memo" ? sectionRange(blocks, /raisonnement décisif/i) : null;
  const modulesRange = family === "cio_memo" ? sectionRange(blocks, /handoffs disponibles|état des modules|modules disponibles/i) : null;
  const decisionTable = firstTable(blocks, decisionRange);
  const reasoning = reasoningRange ? content.blocks.slice(reasoningRange.start + 1, reasoningRange.end).filter(block => {
    if (block.type === "list") return block.items.some(item => item.some(segment => segment.text.trim()));
    if (block.type === "unsupported") return Boolean(block.text?.trim());
    return "text" in block && block.text.some(segment => segment.text.trim());
  }) : [];
  const consumed = new Set<number>([...(decisionTable ? [blocks.indexOf(decisionTable)] : []), ...reasoning.map(block => content.blocks.indexOf(block))]);
  for (const range of [decisionRange, reasoningRange]) {
    if (range && blocks.slice(range.start + 1, range.end).every(block => consumed.has(blocks.indexOf(block)))) consumed.add(range.start);
  }
  const memo = {
    decisionFacts: twoColumnFacts(decisionTable),
    modulesTable: (() => { const source = firstTable(blocks, modulesRange); const block = source ? content.blocks[blocks.indexOf(source)] : null; return block?.type === "table" ? block : null; })(),
    reasoning,
    hiddenIndexes: [...consumed],
  };
  if (decisionTable) {
    const sourceBlockIds = [blockIds[blocks.indexOf(decisionTable)]];
    analysis.presentation.facts.push(...memo.decisionFacts.map((fact, index) => ({ id: `decision:${index}`, label: fact.label, value: fact.value, unit: null, status: "known" as const, asOf: null, sourceBlockIds, provenance })));
  }
  if (!isAnalysis(analysis)) throw new Error(`Analyse canonique invalide : ${document.id}`);
  // Presentation sidecars carry layout and source formatting only. Business values
  // and membership come from the validated canonical contract, never a second parse.
  view.summaryItems = projection.status === "valid" ? visibleSummaryItems([analysis.summary ?? ""]) : analysis.summary?.split("\n").filter(Boolean) ?? [];
  view.facts = analysis.presentation.facts.filter(fact => !fact.id.startsWith("decision:") && fact.status === "known" && fact.value !== null)
    .map(fact => ({ label: fact.label, value: String(fact.value) }));
  memo.decisionFacts = analysis.presentation.facts.filter(fact => fact.id.startsWith("decision:") && fact.value !== null)
    .map(fact => ({ label: fact.label, value: String(fact.value) }));
  if (valuation) {
    valuation.scenarios = analysis.presentation.scenarios.map(scenario => {
      const formatted = valuation.scenarios.find(item => item.name === scenario.label);
      return { name: scenario.label as "Bear" | "Base" | "Bull", terminal: scenario.terminalValue ? formatted?.terminal ?? String(scenario.terminalValue.value) : undefined,
        terminalLabel: scenario.terminalValue?.label, cagr: scenario.cagrPercent ? formatted?.cagr ?? String(scenario.cagrPercent.value) : undefined,
        sourceBlockIndexes: scenario.sourceBlockIds.map(id => blockIds.indexOf(id)).filter(index => index >= 0) };
    });
    valuation.thresholds = analysis.presentation.thresholds.map(threshold => {
      const formatted = valuation.thresholds.find(item => `Prix maximal pour ${item.rate}` === threshold.label);
      return { rate: formatted?.rate ?? threshold.label, price: formatted?.price ?? String(threshold.value),
        sourceBlockIndexes: threshold.sourceBlockIds.map(id => blockIds.indexOf(id)).filter(index => index >= 0) };
    });
  }
  return { analysis, view, valuation, memo };
}
