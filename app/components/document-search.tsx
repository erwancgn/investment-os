"use client";

import { useEffect, useRef, useState } from "react";
import { highlightSearchText, parseSearchTerms, type SearchFreshness, type SearchResult, type SearchSourceKey } from "../lib/search-contract";
import { useOpenAnalysis } from "../lib/app-navigation";
import { ActionButton, AsyncState, Badge, PrimaryBlock, SearchField, SegmentedControl, Surface } from "./ui-primitives";

const sourceLabels: Record<SearchSourceKey, string> = {
  analyses: "Analyses",
  earnings: "Earnings",
  decisions: "Décisions",
  portfolio: "Portfolio",
  companies: "Compagnies",
  watchlist: "Watchlist",
  sources: "Sources",
};

const sourceOptions: { value: SearchSourceKey | "all"; label: string }[] = [
  { value: "all", label: "Toutes les sources" },
  ...Object.entries(sourceLabels).map(([value, label]) => ({ value: value as SearchSourceKey, label })),
];

const shortDate = (value: string | null) => value
  ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return <>{highlightSearchText(text, terms).map((part, index) => part.match
    ? <mark key={`${part.text}-${index}`}>{part.text}</mark>
    : <span key={`${part.text}-${index}`}>{part.text}</span>)}</>;
}

type SearchPayload = {
  query: string;
  terms: string[];
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  source: SearchSourceKey | "all";
  freshness: SearchFreshness;
};

const emptyPayload: SearchPayload = { query: "", terms: [], results: [], total: 0, limit: 20, offset: 0, source: "all", freshness: "current" };

export function DocumentSearch({ openCompany }: { openCompany: (companyId: string) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [source, setSource] = useState<SearchSourceKey | "all">("all");
  const [freshness, setFreshness] = useState<SearchFreshness>("current");
  const [payload, setPayload] = useState<SearchPayload>(emptyPayload);
  const openAnalysis = useOpenAnalysis();
  const requestRef = useRef<AbortController | null>(null);
  const cancelRequest = () => { requestRef.current?.abort(); };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const terms = parseSearchTerms(debouncedQuery);
    if (!terms.length) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const params = new URLSearchParams({ q: debouncedQuery, source, freshness, limit: "20", offset: "0" });
    const requestStart = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/notion/search?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async response => {
          const next: SearchPayload & { error?: string } = await response.json();
          if (!response.ok) throw new Error(next.error ?? "Recherche impossible");
          if (!controller.signal.aborted) setPayload(next);
        })
        .catch(reason => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : "Recherche impossible");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(requestStart); controller.abort(); requestRef.current?.abort(); };
  }, [debouncedQuery, source, freshness]);

  const changeQuery = (value: string) => {
    cancelRequest();
    setQuery(value);
    if (!parseSearchTerms(value).length) {
      setPayload({ ...emptyPayload, query: value.trim(), source, freshness });
      setLoading(false);
      setError("");
    }
  };

  const loadMore = async () => {
    if (loading || query.trim() !== debouncedQuery || payload.query !== debouncedQuery || payload.source !== source || payload.freshness !== freshness || payload.results.length >= payload.total) return;
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: debouncedQuery, source, freshness, limit: "20", offset: String(payload.results.length) });
      const response = await fetch(`/api/notion/search?${params}`, { cache: "no-store", signal: controller.signal });
      const next: SearchPayload & { error?: string } = await response.json();
      if (!response.ok) throw new Error(next.error ?? "Recherche impossible");
      if (!controller.signal.aborted) setPayload(previous => ({ ...next, results: [...previous.results, ...next.results] }));
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Recherche impossible");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const open = async (result: SearchResult) => {
    if (result.destination === "company" && result.companyId) {
      openCompany(result.companyId);
      return;
    }
    if (result.destination === "notion") {
      window.open(result.notionUrl, "_blank", "noopener,noreferrer");
      return;
    }
    openAnalysis(result.id);
  };

  const hasQuery = parseSearchTerms(query).length > 0;
  const settled = debouncedQuery === query.trim();
  return <>
    <section className="research-search-workspace">
      <div className="research-search-heading">
        <div className="ai-orb text-orb">TXT</div>
        <div><h2>Recherche documentaire globale</h2><p>Retrouve un concept dans le texte complet des snapshots Notion, puis ouvre sa source réelle.</p></div>
      </div>
      <SearchField value={query} onChange={changeQuery} placeholder="Ex. dilution, contracted power, ROIC, CoWoS…" ariaLabel="Rechercher dans toute la documentation Notion" count={hasQuery && settled && !loading ? `${payload.total} résultat${payload.total > 1 ? "s" : ""}` : undefined} className="global-search-field" />
      <div className="global-search-filters">
        <SegmentedControl options={[{ value: "current", label: "Actuels" }, { value: "all", label: "Tous" }, { value: "archives", label: "Archives" }]} value={freshness} onChange={value => { cancelRequest(); setFreshness(value as SearchFreshness); }} ariaLabel="Fraîcheur des résultats" />
        <label><span>Source</span><select value={source} onChange={event => { cancelRequest(); setSource(event.target.value as SearchSourceKey | "all"); }} aria-label="Filtrer par source">{sourceOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      </div>
    </section>

    {error && <AsyncState title="Recherche indisponible" description={error} />}
    {!hasQuery && <PrimaryBlock as="article" className="search-empty-state"><h3>Cherche une information, pas seulement un titre</h3><p>La recherche couvre les analyses, earnings, décisions, fiches sociétés, watchlist, positions et sources.</p><div><button type="button" onClick={() => setQuery("dilution")}>dilution</button><button type="button" onClick={() => setQuery("ROIC")}>ROIC</button><button type="button" onClick={() => setQuery("contracted power")}>contracted power</button></div></PrimaryBlock>}
    {hasQuery && loading && payload.results.length === 0 && <AsyncState title="Recherche en cours" description="Lecture de l’index documentaire complet…" />}
    {hasQuery && settled && !loading && !error && payload.results.length === 0 && <PrimaryBlock as="article" className="empty-result"><h3>Aucun passage trouvé</h3><p>Essaie un terme plus court, une autre source ou le filtre « Tous ».</p></PrimaryBlock>}
    {payload.results.length > 0 && <section className="search-results" aria-live="polite">
      <header className="search-results-header"><div><h2>{payload.total} résultat{payload.total > 1 ? "s" : ""}</h2><p>Classés par correspondance, statut actuel et fraîcheur.</p></div><small>{payload.results.length} affiché{payload.results.length > 1 ? "s" : ""}</small></header>
      {payload.results.map(result => <Surface as="button" surface="primary" className="search-result" key={result.id} onClick={() => open(result)}>
        <div className="search-result-signals"><Badge tone={result.archived ? "warning" : "positive"}>{result.archived ? "Archive" : "Actuel"}</Badge><Badge>{sourceLabels[result.sourceKey]}</Badge><span>{result.occurrenceCount} occurrence{result.occurrenceCount > 1 ? "s" : ""}</span></div>
        <h3><Highlight text={result.title} terms={payload.terms} /></h3>
        <p className="search-result-meta">{result.companyName} · {result.agent} · {shortDate(result.date || result.lastEditedTime)}</p>
        <p className="search-result-excerpt"><Highlight text={result.excerpt} terms={payload.terms} /></p>
        <strong>{result.destination === "company" ? "Ouvrir la fiche entreprise" : result.destination === "notion" ? "Ouvrir dans Notion ↗" : "Ouvrir le document intégral"} →</strong>
      </Surface>)}
      {payload.results.length < payload.total && <div className="search-load-more"><ActionButton onClick={loadMore}>{loading ? "Chargement…" : `Afficher ${Math.min(20, payload.total - payload.results.length)} résultats de plus`}</ActionButton></div>}
    </section>}
  </>;
}
