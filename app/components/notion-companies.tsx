"use client";

import { useMemo, useState } from "react";
import { useClientResource } from "../lib/client-resource";
import type { CompanyListItem } from "../lib/investment-data";
import { compactDecisionLabel, formatAnalysisDate } from "../lib/decision-label";
import { AsyncState, Badge, DiscoveryCard, FilterBar, SearchField, SegmentedControl } from "./ui-primitives";

const referenceLabels = { business: "Business", valuation: "Valorisation", short: "Short", portfolio: "PF Fit", memo: "Mémo" } as const;
const referenceOrder = ["business", "valuation", "short", "portfolio", "memo"] as const;
const companyFilters = ["Toutes", "Owned", "Watchlist", "Not owned", "Hors watchlist"] as const;

function referenceValue(reference: CompanyListItem["researchReferences"][number]) {
  if (reference.kind === "business" || reference.kind === "valuation") return reference.score || "—";
  const verdict = reference.verdict.trim();
  if (reference.kind === "portfolio" || reference.kind === "memo") {
    return compactDecisionLabel(verdict);
  }
  if (/aucun short|pas de short|no short/i.test(verdict)) return "Aucun short";
  if (/watchlist|surveiller|watch/i.test(verdict)) return "À surveiller";
  if (/short/i.test(verdict)) return "Short";
  return "Voir l’avis";
}

function referenceDetail(reference: CompanyListItem["researchReferences"][number]) {
  const value = reference.date || reference.lastEditedTime;
  return formatAnalysisDate(value);
}

function matchesCompanyFilter(item: CompanyListItem, filter: string) {
  if (filter === "Owned") return item.ownershipStatus === "Owned";
  if (filter === "Watchlist") return item.watchlistMembership;
  if (filter === "Not owned") return item.ownershipStatus === "Not owned";
  if (filter === "Hors watchlist") return !item.watchlistMembership;
  return true;
}

export function NotionCompanies({ openCompany, initialData }: { openCompany: (companyId: string, documentId?: string) => void; initialData?: { companies: CompanyListItem[] } }) {
  const { data, loading, error } = useClientResource<{ companies: CompanyListItem[] }>("/api/companies", false, initialData === undefined);
  const companies = useMemo(() => data?.companies ?? initialData?.companies ?? [], [data, initialData]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof companyFilters)[number]>("Toutes");

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return companies.filter((item) => matchesCompanyFilter(item, filter) && `${item.name} ${item.ticker} ${item.sector} ${item.industry} ${item.themes.join(" ")} ${item.monitoringStatus} ${item.decision}`.toLowerCase().includes(normalizedQuery));
  }, [companies, filter, query]);

  return <>
    <SearchField value={query} onChange={setQuery} placeholder="Rechercher une compagnie, un ticker ou un thème…" ariaLabel="Rechercher dans les compagnies" count={loading && !initialData ? "Chargement…" : `${visible.length}/${companies.length} compagnies`} />
    <FilterBar className="company-filter-bar" ariaLabel="Filtres des compagnies"><SegmentedControl className="company-filter-controls" options={companyFilters.map((item) => ({ value: item, label: item }))} value={filter} onChange={(value) => setFilter(value as (typeof companyFilters)[number])} ariaLabel="Filtrer les compagnies par détention et watchlist" /></FilterBar>
    {error && !initialData && <AsyncState title="Base Companies indisponible" description={error} />}{<section className="company-table research-company-table">
      <div className="table-head"><span>Compagnie</span><span>Chaîne d’analyse actuelle</span><span>État d’investissement</span><span>Dernière analyse</span><span /></div>
      {visible.map((item) => <DiscoveryCard as="article" kind="company" className="table-row company-list-row" key={item.id}>
        <button type="button" className="company-identity company-identity-button" onClick={() => openCompany(item.id)} aria-label={`Ouvrir la fiche ${item.name}`}>
          <div className="company-logo">{(item.ticker || item.name).slice(0, 2).toUpperCase()}</div>
          <div className="company-identity-copy"><div><strong>{item.name}</strong>{item.ownershipStatus === "Owned" && <Badge tone="positive">Owned</Badge>}</div><small>{item.ticker || "Sans ticker"} · {item.industry || item.sector || "Classification à compléter"}</small></div>
        </button>
        <div className="research-reference-grid">{referenceOrder.map((kind) => {
          const reference = item.researchReferences.find((doc) => doc.kind === kind);
          return reference ? <button type="button" onClick={() => openCompany(item.id, reference.id)} className={`research-reference available reference-${kind}`} title={`${reference.title} · ${reference.verdict || reference.status}`} aria-label={`Ouvrir ${referenceLabels[kind]} de ${item.name}`} key={kind}><span>{referenceLabels[kind]}</span><strong>{referenceValue(reference)}</strong><small>{referenceDetail(reference)}</small></button> : <span className="research-reference missing" key={kind}><span>{referenceLabels[kind]}</span><strong>—</strong><small>Non disponible</small></span>;
        })}</div>
        <div className="company-state-tags">
          {item.watchlistMembership && <Badge>Watchlist</Badge>}
          {item.watchlistMembership && item.monitoringStatus && <small>{item.monitoringStatus}{item.decision ? ` · ${item.decision}` : ""}</small>}
          {!item.watchlistMembership && item.ownershipStatus !== "Owned" && <span className="signal">Non classé</span>}
        </div>
        <div className="date-cell"><strong>{formatAnalysisDate(item.lastAnalysis)}</strong><small>{item.researchReferences.length}/5 références</small></div>
        <button type="button" className="row-arrow" onClick={() => openCompany(item.id)} aria-label={`Ouvrir ${item.name}`}>→</button>
      </DiscoveryCard>)}
    </section>}
  </>;
}
