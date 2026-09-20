"use client";

import { useMemo, useState } from "react";
import { useClientResource } from "../lib/client-resource";
import type { WatchlistData, WatchlistItem } from "../lib/investment-data";
import { AsyncState, Badge, DisclosureSurface, DiscoveryAction, DiscoveryCard, FilterBar, PrimaryBlock, SearchField, SegmentedControl } from "./ui-primitives";

const monitoringStatuses = ["Toutes", "Monitoring", "To analyse", "Ready to buy", "Excluded"];

export function NotionWatchlist({ openCompany, initialData }: { openCompany: (companyId: string) => void; initialData?: WatchlistData }) {
  const { data: payload, loading, error } = useClientResource<WatchlistData>("/api/watchlist", false, initialData === undefined);
  const data = useMemo(() => payload ?? initialData ?? { items: [], themes: [] }, [payload, initialData]);
  const [theme, setTheme] = useState("Tous les thèmes");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Toutes");

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.items.filter((item) =>
      (theme === "Tous les thèmes" || item.themes.includes(theme))
      && (status === "Toutes" || item.monitoringStatus === status)
      && `${item.name} ${item.ticker} ${item.thesis} ${item.themes.join(" ")} ${item.monitoringStatus} ${item.decision}`.toLowerCase().includes(normalizedQuery));
  }, [data, theme, status, query]);
  const open = (item: WatchlistItem) => item.companyIds[0] ? openCompany(item.companyIds[0]) : window.open(item.notionUrl, "_blank", "noopener,noreferrer");

  return <>
    <div className="watchlist-overview"><PrimaryBlock><p className="eyebrow">Sociétés suivies</p><strong>{loading && !payload && !initialData ? "—" : data.items.length}</strong><span>dans le Radar</span></PrimaryBlock><PrimaryBlock><p className="eyebrow">À analyser</p><strong>{data.items.filter((item) => item.monitoringStatus === "To analyse").length}</strong><span>selon le suivi canonique</span></PrimaryBlock><PrimaryBlock><p className="eyebrow">Ready to buy</p><strong>{data.items.filter((item) => item.monitoringStatus === "Ready to buy").length}</strong><span>selon le suivi canonique</span></PrimaryBlock></div>
    <SearchField value={query} onChange={setQuery} placeholder="Rechercher une société, un ticker ou une thèse…" ariaLabel="Rechercher dans la watchlist" count={loading && !initialData ? "Chargement…" : `${visible.length}/${data.items.length} sociétés`} />
    <FilterBar ariaLabel="Filtres de la watchlist"><SegmentedControl options={monitoringStatuses.map((item) => ({ value: item, label: item }))} value={status} onChange={setStatus} ariaLabel="Filtrer la watchlist par étape de suivi" className="watch-status-filters" /></FilterBar>
    <DisclosureSurface level="primary" className="watch-theme-filter" summary={<><span>Thèmes</span><strong>{theme}</strong></>}><SegmentedControl options={[{ value: "Tous les thèmes", label: "Tous les thèmes" }, ...data.themes.map((item) => ({ value: item, label: <><span>{item}</span><small>{data.items.filter((company) => company.themes.includes(item)).length}</small></> }))]} value={theme} onChange={setTheme} ariaLabel="Filtrer la watchlist par thème" className="theme-cloud" /></DisclosureSurface>
    {error && !initialData && <AsyncState title="Watchlist Notion indisponible" description={error} />}{<section className="watch-grid notion-watch-grid">{visible.map((item) => <DiscoveryCard as="article" kind="watchlist" className="watch-card-compact" key={item.id}>
      <header className="watch-card-head">
        <div className="company-logo">{(item.ticker || item.name).slice(0, 2).toUpperCase()}</div>
        <div className="watch-card-identity"><div className="watch-card-title"><h3>{item.name}</h3><Badge tone={item.monitoringStatus === "Ready to buy" ? "positive" : "neutral"}>{item.monitoringStatus || "Non renseigné"}</Badge></div><small>{item.ticker || "Sans ticker"}</small></div>
        <DiscoveryAction onClick={() => open(item)} ariaLabel={`Ouvrir ${item.name}`}><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" /></svg></DiscoveryAction>
      </header>
      <div className="watch-signal-row"><span><small>Décision actuelle</small><strong className={`watch-decision decision-${item.decision.toLowerCase().replaceAll(" ", "-")}`}>{item.decision || "Non analysée"}</strong></span><span><small>Ownership</small><strong>{item.ownershipStatus}</strong></span><span><small>Confiance analyse</small><strong>{item.conviction || "Non renseignée"}</strong><small>{item.analysisDate ? new Date(item.analysisDate).toLocaleDateString("fr-FR") : "Aucune analyse actuelle"}</small></span></div>
      <div className="watch-theme-tags">{item.themes.slice(0, 3).map((themeName) => <Badge key={themeName}>{themeName}</Badge>)}{item.themes.length > 3 && <Badge>+{item.themes.length - 3}</Badge>}</div>
      <p className="watch-thesis">{item.thesis || "Thèse courte à compléter dans Notion."}</p>
    </DiscoveryCard>)}</section>}
  </>;
}
