"use client";

import { useMemo, useState } from "react";
import { useClientResource } from "../lib/client-resource";
import type { ResearchDocument } from "../lib/investment-data";
import { useOpenAnalysis } from "../lib/app-navigation";
import { ActionButton, AsyncState, Badge, DiscoveryCard, FilterBar, SearchField, SectionHeader, SegmentedControl, StatCard } from "./ui-primitives";

type AnalysesPayload = { documents: ResearchDocument[]; counts: Record<string, number> };

export type NotionAnalysesProps = {
  initialData?: AnalysesPayload;
  initialLoading?: boolean;
  initialError?: string | null;
};

const labels: Record<string, string> = {
  analyses: "Analyses",
  earnings: "Earnings",
  portfolio: "Portfolio",
  decisions: "Décisions",
  archives: "Archives",
};
const shortDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export function NotionAnalyses({ initialData, initialLoading, initialError }: NotionAnalysesProps = {}) {
  const fixtureMode = initialData !== undefined || initialLoading !== undefined || initialError !== undefined;
  const resource = useClientResource<AnalysesPayload>("/api/analyses", false, !fixtureMode);
  const data = fixtureMode ? initialData : resource.data;
  const loading = fixtureMode ? initialLoading ?? false : resource.loading;
  const error = fixtureMode ? initialError ?? "" : resource.error;
  const documents = useMemo(() => data?.documents ?? [], [data]);
  const counts = data?.counts ?? {};
  const openAnalysis = useOpenAnalysis();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("Toutes");
  const [visibleCount, setVisibleCount] = useState(40);

  const activeDocuments = useMemo(() => documents.filter((item) => !item.archived), [documents]);
  const archivedDocuments = useMemo(() => documents.filter((item) => item.archived), [documents]);
  const sourceDocuments = source === "archives" ? archivedDocuments : activeDocuments;
  const filtered = useMemo(() => sourceDocuments.filter((item) => (source === "Toutes" || source === "archives" || item.sourceKey === source) && `${item.title} ${item.companyName} ${item.agent} ${item.verdict} ${item.plainText}`.toLowerCase().includes(query.toLowerCase())), [sourceDocuments, query, source]);

  const open = (item: ResearchDocument) => openAnalysis(item.id);

  return (
    <>
      {error && <AsyncState title="Synchronisation impossible" description={error} />}
      <SectionHeader title={source === "archives" ? "Archives documentaires" : "Rapports et décisions"} description={source === "archives" ? "Versions remplacées conservées avec leurs relations Notion." : "Bibliothèque des documents actifs importés depuis Notion. Les anciennes versions sont accessibles via le filtre Archives."} meta={loading ? "Chargement…" : source === "archives" ? `${archivedDocuments.length} documents archivés` : `${activeDocuments.length} documents actifs`} />
      <div className="analysis-stats">
        <StatCard label="Analyses" value={counts.analyses ?? 0} detail="Business · Valuation · Short · Mémo" />
        <StatCard label="Earnings" value={counts.earnings ?? 0} detail="Publications et guidances" />
        <StatCard label="Portfolio & décisions" value={(counts.portfolio ?? 0) + (counts.decisions ?? 0)} detail="Allocation et journal de décision" />
      </div>
      <SearchField
        value={query}
        onChange={(value) => {
          setQuery(value);
          setVisibleCount(40);
        }}
        placeholder="Rechercher une entreprise, une analyse ou un agent…"
        ariaLabel="Rechercher dans les analyses"
        count={`${filtered.length}/${sourceDocuments.length} documents`}
      />
      <FilterBar ariaLabel="Filtres des analyses">
        <SegmentedControl
          options={["Toutes", "analyses", "earnings", "portfolio", "decisions", "archives"].map((key) => ({
            value: key,
            label: key === "Toutes" ? key : labels[key],
          }))}
          value={source}
          onChange={(value) => {
            setSource(value);
            setVisibleCount(40);
          }}
          ariaLabel="Filtrer les analyses"
        />
      </FilterBar>
      <section className="analysis-list">
        <div className="table-head analysis-list-head">
          <span>Rapport</span>
          <span>Conclusion</span>
          <span>Verdict</span>
          <span>Fraîcheur</span>
        </div>
        {filtered.slice(0, visibleCount).map((item) => (
          <DiscoveryCard as="button" type="button" kind="analysis" className="analysis-list-row" key={item.id} onClick={() => open(item)}>
            <div className="analysis-title">
              <span>{(item.companyName === "Non relié" ? item.agent : item.companyName).slice(0, 2).toUpperCase()}</span>
              <div className="analysis-title-copy">
                <div><strong>{item.title}</strong><Badge className="analysis-agent">{item.agent}</Badge></div>
                <small>
                  {item.companyName} · {labels[item.sourceKey] ?? item.sourceKey}
                </small>
              </div>
            </div>
            <strong className="analysis-score-cell">{item.category === "business" || item.category === "valuation" ? item.score || "—" : item.verdict || item.status || "Disponible"}</strong>
            <span className="analysis-verdict-cell">{item.verdict || item.status || "Document Notion"}</span>
            <Badge tone="positive" className="analysis-freshness">
              {shortDate(item.date || item.lastEditedTime)}
            </Badge>
          </DiscoveryCard>
        ))}
      </section>
      {visibleCount < filtered.length && (
        <ActionButton className="analysis-load-more" onClick={() => setVisibleCount((value) => value + 40)}>
          Afficher 40 documents de plus
        </ActionButton>
      )}
    </>
  );
}
