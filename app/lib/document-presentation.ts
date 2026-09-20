import type { RenderBlock } from "./notion-renderer";

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
  return summaryHeadingPattern.test(text.trim());
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
  return items.filter((item) => !/^run(?:\s*id)?\s*[:#—–-]?\s*[A-Z0-9][A-Z0-9._-]*\.?\s*$/i.test(compact(item)));
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
  if (summaryHeadingIndex >= 0) for (let index = summaryHeadingIndex; index < summaryEndIndex; index++) hiddenIndexes.add(index);
  else if (fallbackBlock) {
    const fallbackIndex = blocks.indexOf(fallbackBlock);
    if (fallbackIndex >= 0) hiddenIndexes.add(fallbackIndex);
  }

  // A number of Notion templates start with a compact metadata paragraph
  // (date, ticker, currency, period…). Once those values are promoted to the
  // fact grid, keeping the raw paragraph would duplicate them as an
  // unreadable wall of text on mobile.
  factScope.forEach(block => {
    if (block.type === "heading" || block.type === "table") return;
    const extractedFacts = blockText(block).flatMap(factsFromText);
    if (extractedFacts.length >= 2) {
      const index = blocks.indexOf(block);
      if (index >= 0) hiddenIndexes.add(index);
    }
  });

  return { summaryItems, facts: uniqueFacts, hiddenIndexes };
}
