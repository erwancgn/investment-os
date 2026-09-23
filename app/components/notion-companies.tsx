"use client";

import { useMemo, useState } from "react";
import { useClientResource } from "../lib/client-resource";
import type { CompanyListItem } from "../lib/investment-data";
import { compactDecisionLabel, formatAnalysisDate } from "../lib/decision-label";
import { AsyncState, Badge, DisclosureSurface, DiscoveryCard, SearchField, Tabs } from "./ui-primitives";

const referenceLabels = { business: "Business", valuation: "Valorisation", short: "Short", portfolio: "PF Fit", memo: "Mémo" } as const;
const referenceOrder = ["business", "valuation", "short", "portfolio", "memo"] as const;
const companyFilters = ["Toutes", "Détenues", "Watchlist"] as const;

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
  if (filter === "Détenues") return item.ownershipStatus === "Owned";
  if (filter === "Watchlist") return item.watchlistMembership;
  return true;
}

export function NotionCompanies({ openCompany, initialData }: { openCompany: (companyId: string, documentId?: string) => void; initialData?: { companies: CompanyListItem[] } }) {
  const { data, loading, error } = useClientResource<{ companies: CompanyListItem[] }>("/api/companies", false, initialData === undefined);
  const companies = useMemo(() => data?.companies ?? initialData?.companies ?? [], [data, initialData]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof companyFilters)[number]>("Toutes");

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return companies.filter((item) => matchesCompanyFilter(item, filter) && `${item.name} ${item.ticker} ${item.sector} ${item.industry} ${item.themes.join(" ")}`.toLowerCase().includes(normalizedQuery));
  }, [companies, filter, query]);

  return <>
    <SearchField
      value={query}
      onChange={setQuery}
      placeholder="Nom, ticker ou thème…"
      ariaLabel="Rechercher une entreprise"
      count={loading && !initialData && !data ? "Chargement…" : `${visible.length}/${companies.length} entreprises`}
    />
    <DisclosureSurface className="company-filter-disclosure" summary={<span><strong>Filtres</strong><small>{filter}</small></span>}>
      <Tabs
        options={companyFilters.map((item) => ({ value: item, label: item }))}
        value={filter}
        onChange={setFilter}
        ariaLabel="Vues des compagnies"
        panelId="companies-results"
      />
    </DisclosureSurface>
    {error && data && !initialData ? <p className="resource-error" role="status">{error} Les dernières données chargées restent affichées.</p> : null}
    <section id="companies-results" className="company-table company-directory" role="tabpanel" aria-label={`Entreprises : ${filter}`} tabIndex={0}>
      {loading && !initialData && !data ? (
        <AsyncState title="Chargement des compagnies…" description="Lecture de la base Companies." />
      ) : error && !initialData && !data ? (
        <AsyncState title="Base Companies indisponible" description={error} />
      ) : visible.length === 0 ? (
        <AsyncState
          title={companies.length ? "Aucune compagnie trouvée" : "Aucune compagnie disponible"}
          description={companies.length ? "Essayez une autre recherche ou un autre filtre." : "La base Companies ne contient encore aucune société."}
        />
      ) : (
        <>
          <div className="table-head"><span>Compagnie</span><span>Chaîne d’analyse actuelle</span><span>État d’investissement</span><span>Dernière analyse</span></div>
          {visible.map((item) => <DiscoveryCard as="article" kind="company" className="table-row company-list-row" key={item.id}>
            <button type="button" className="company-identity company-identity-button" onClick={() => openCompany(item.id)} aria-label={`Ouvrir la fiche ${item.name}`}>
              <div className="company-logo">{(item.ticker || item.name).slice(0, 2).toUpperCase()}</div>
              <div className="company-identity-copy"><div><strong>{item.name}</strong></div><small>{item.ticker || "Sans ticker"} · {item.industry || item.sector || "Classification à compléter"}</small></div>
              <span className="company-open-arrow" aria-hidden="true">→</span>
            </button>
            <div className="company-state-tags">
              {item.ownershipStatus === "Owned" && <Badge tone="positive">Détenue</Badge>}
              {item.watchlistMembership && <Badge>Watchlist</Badge>}
            </div>
            <div className="date-cell"><strong>{formatAnalysisDate(item.lastAnalysis)}</strong><small>{item.researchReferences.length}/5 références</small></div>
            <div className="company-reference-grid">{referenceOrder.map((kind) => {
              const reference = item.researchReferences.find((doc) => doc.kind === kind);
              return reference ? <button type="button" onClick={() => openCompany(item.id, reference.id)} className={`company-reference available reference-${kind}`} title={`${reference.title} · ${reference.verdict || reference.status}`} aria-label={`Ouvrir ${referenceLabels[kind]} de ${item.name}`} key={kind}><span>{referenceLabels[kind]}</span><strong>{referenceValue(reference)}</strong><small>{referenceDetail(reference)}</small></button> : <span className="company-reference missing" key={kind}><span>{referenceLabels[kind]}</span><strong>{kind === "memo" ? "Pas de décision CIO" : "—"}</strong><small>{kind === "memo" ? "Mémo Current validé absent" : "Non disponible"}</small></span>;
            })}</div>
          </DiscoveryCard>)}
        </>
      )}
    </section>
  </>;
}
