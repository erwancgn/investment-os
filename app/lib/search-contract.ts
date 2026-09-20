export const searchSourceKeys = ["analyses", "earnings", "decisions", "portfolio", "companies", "watchlist", "sources"] as const;

export type SearchSourceKey = typeof searchSourceKeys[number];
export type SearchFreshness = "all" | "current" | "archives";

export type SearchIndexDocument = {
  id: string;
  sourceKey: SearchSourceKey;
  title: string;
  companyName: string;
  companyId: string | null;
  category: string;
  agent: string;
  notionUrl: string;
  lastEditedTime: string;
  date: string | null;
  status: string;
  verdict: string;
  plainText: string;
  current: boolean;
  validated: boolean;
  archived: boolean;
  destination: "document" | "company" | "notion";
};

export type SearchResult = Omit<SearchIndexDocument, "plainText"> & {
  matchScore: number;
  occurrenceCount: number;
  matchedTerms: string[];
  excerpt: string;
};

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSearchTerms(query: string): string[] {
  return [...new Set(normalizeSearchText(query).split(" ").filter(term => term.length >= 2))].slice(0, 6);
}

function occurrenceCount(haystack: string, term: string): number {
  let count = 0;
  let cursor = 0;
  while ((cursor = haystack.indexOf(term, cursor)) >= 0) {
    count += 1;
    cursor += Math.max(term.length, 1);
  }
  return count;
}

function foldedTextWithMap(value: string): { folded: string; positions: number[] } {
  let folded = "";
  const positions: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const normalized = value[index]
      .toLocaleLowerCase("fr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .replace(/[^a-z0-9]/g, " ");
    for (const character of normalized) {
      folded += character;
      positions.push(index);
    }
  }
  return { folded, positions };
}

export function searchExcerpt(value: string, terms: string[], before = 115, after = 235): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const { folded, positions } = foldedTextWithMap(compact);
  const matches = terms
    .map(term => ({ term, index: folded.indexOf(term) }))
    .filter(match => match.index >= 0)
    .sort((left, right) => left.index - right.index);
  const match = matches[0];
  if (!match) return compact.slice(0, before + after);
  const originalStart = positions[match.index] ?? 0;
  const originalEnd = positions[Math.min(match.index + match.term.length - 1, positions.length - 1)] ?? originalStart;
  const start = Math.max(0, originalStart - before);
  const end = Math.min(compact.length, originalEnd + after);
  return `${start > 0 ? "… " : ""}${compact.slice(start, end).trim()}${end < compact.length ? " …" : ""}`;
}

export function highlightSearchText(value: string, terms: string[]): { text: string; match: boolean }[] {
  if (!value || !terms.length) return [{ text: value, match: false }];
  const { folded, positions } = foldedTextWithMap(value);
  const ranges: { start: number; end: number }[] = [];
  for (const term of terms) {
    let cursor = 0;
    while ((cursor = folded.indexOf(term, cursor)) >= 0) {
      const start = positions[cursor] ?? 0;
      const end = (positions[Math.min(cursor + term.length - 1, positions.length - 1)] ?? start) + 1;
      ranges.push({ start, end });
      cursor += Math.max(term.length, 1);
    }
  }
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  if (!merged.length) return [{ text: value, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: value.slice(cursor, range.start), match: false });
    parts.push({ text: value.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), match: false });
  return parts;
}

export function rankSearchDocuments(documents: SearchIndexDocument[], query: string): SearchResult[] {
  const terms = parseSearchTerms(query);
  if (!terms.length) return [];
  return documents.flatMap(document => {
    const { plainText, ...metadata } = document;
    const title = normalizeSearchText(document.title);
    const company = normalizeSearchText(document.companyName);
    const content = normalizeSearchText(plainText);
    if (!terms.every(term => title.includes(term) || company.includes(term) || content.includes(term))) return [];
    const focus = content.slice(0, 1800);
    const titleHits = terms.reduce((sum, term) => sum + occurrenceCount(title, term), 0);
    const companyHits = terms.reduce((sum, term) => sum + occurrenceCount(company, term), 0);
    const focusHits = Math.min(terms.reduce((sum, term) => sum + occurrenceCount(focus, term), 0), 6);
    const bodyHits = terms.reduce((sum, term) => sum + occurrenceCount(content, term), 0);
    const matchScore = titleHits * 140
      + companyHits * 95
      + focusHits * 28
      + Math.min(bodyHits, 24) * 4
      + (document.current ? 190 : 0)
      + (document.validated ? 55 : 0)
      - (document.archived ? 150 : 0);
    return [{
      ...metadata,
      matchScore,
      occurrenceCount: bodyHits + titleHits + companyHits,
      matchedTerms: terms,
      excerpt: searchExcerpt(plainText, terms),
    }];
  }).sort((left, right) => {
    if (right.matchScore !== left.matchScore) return right.matchScore - left.matchScore;
    const dateDelta = Date.parse(right.date || right.lastEditedTime) - Date.parse(left.date || left.lastEditedTime);
    if (Number.isFinite(dateDelta) && dateDelta !== 0) return dateDelta;
    return left.id.localeCompare(right.id);
  });
}
