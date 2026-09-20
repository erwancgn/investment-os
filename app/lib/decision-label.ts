export type DecisionAction = "Conserver" | "Renforcer" | "Attendre" | "Alléger" | "Ajouter" | "Surveiller" | "Vendre" | "Éviter" | "Short" | "Aucun short";

const actionPatterns: Array<[DecisionAction, RegExp]> = [
  ["Aucun short", /^(?:aucun short|pas de short|no short)\b/i],
  ["Short", /^(?:short|short seller)\b/i],
  ["Attendre", /^(?:attendre|hold\s*off)\b/i],
  ["Conserver", /^(?:conserver|hold)\b/i],
  ["Renforcer", /^(?:renforcer)\b/i],
  ["Ajouter", /^(?:ajouter)\b/i],
  ["Alléger", /^(?:all[eé]ger)\b/i],
  ["Surveiller", /^(?:surveiller|watchlist|watch)\b/i],
  ["Vendre", /^(?:vendre)\b/i],
  ["Éviter", /^(?:[eé]viter)\b/i],
];

function normalizedText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function decisionParts(value: string | null | undefined) {
  const text = normalizedText(value);
  if (!text) return { action: "—", detail: "" };
  const match = actionPatterns.find(([, pattern]) => pattern.test(text));
  if (!match) return { action: "Voir l’avis", detail: text };
  const detail = text.replace(match[1], "").replace(/^\s*[—–:;/]+\s*/, "").trim();
  return { action: match[0], detail };
}

export function compactDecisionLabel(value: string | null | undefined, fallback = "Voir l’avis") {
  const { action } = decisionParts(value);
  return action === "—" ? fallback : action;
}

export function formatAnalysisDate(value: string | null | undefined, fallback: string | null | undefined = null) {
  const source = value || fallback;
  if (!source) return "—";
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(parsed);
}

type AnalysisDisplayDocument = { category: string; title?: string; score?: string | null; verdict?: string | null; status?: string | null; date?: string | null; lastEditedTime?: string | null };

export function analysisDisplayValue(document: AnalysisDisplayDocument) {
  if (document.category === "business" || document.category === "valuation") return document.score?.trim() || "—";
  return compactDecisionLabel(document.verdict || document.status);
}

export function analysisTypeLabel(document: Pick<AnalysisDisplayDocument, "category" | "title">) {
  const category = document.category === "valuation" ? "Valorisation" : document.category === "risques" ? "Short" : document.category === "synthese" ? "Mémo CIO" : document.category === "portfolio" ? "Portfolio" : document.category === "business" ? "Business" : "Analyse";
  return /full\s*(?:analyse|analysis)|analyse\s+compl[eè]te/i.test(document.title || "") ? `${category} · analyse complète` : category;
}
