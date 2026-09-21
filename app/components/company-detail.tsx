"use client";
import { useMemo, useState } from "react";
import type { CompanyDetail, CompanyDocument, CompanySectionKey, EarningsRefreshStatus } from "../lib/investment-data";
import { analysisDisplayValue, analysisTypeLabel, formatAnalysisDate } from "../lib/decision-label";
import { LiveHoldingSummary } from "./live-holding-summary";
import { useOpenAnalysis } from "../lib/app-navigation";
import { useClientResource } from "../lib/client-resource";
import { LatestInfoCard } from "./latest-info-card";
import { ActionButton, BackButton, Badge, DataTable, DisclosureSurface, MetadataGrid, PrimaryBlock, SecondaryBlock, SectionHeader, StatCard, Tabs, type BadgeTone, type DataTableColumn } from "./ui-primitives";

type CompanyTab = CompanySectionKey | "memo";
const tabs: [CompanyTab, string][] = [
  ["synthese", "Synthèse"],
  ["memo", "Mémo CIO"],
  ["portfolio", "Portfolio"],
  ["business", "Business"],
  ["valuation", "Valorisation"],
  ["risques", "Short"],
  ["earnings", "Earnings"],
  ["analyses", "Analyses"],
];
const sectionTitles: Record<CompanyTab, string> = {
  synthese: "Synthèse de la recherche",
  memo: "Investment Mémo CIO",
  portfolio: "Suivi dans le portefeuille",
  business: "Business",
  valuation: "Valorisation",
  risques: "Short et invalidation",
  earnings: "Earnings",
  analyses: "Toutes les analyses",
};

function shortDate(value: string | null) {
  const date = formatAnalysisDate(value);
  return date === "—" ? "Date non renseignée" : date;
}

function documentConclusion(document: CompanyDocument) {
  return analysisDisplayValue(document);
}

function completenessLabel(value: string) {
  if (/^complete$/i.test(value)) return "Complète";
  if (/^partial$/i.test(value)) return "Partielle";
  if (/^incomplete$/i.test(value)) return "Incomplète";
  return value || "—";
}

function DocumentRow({ doc, label, onOpen }: { doc: CompanyDocument; label: string; onOpen: (doc: CompanyDocument) => void }) {
  return (
    <button type="button" className="section-document-row section-document-button" onClick={() => onOpen(doc)}>
      <span>
        <strong>{analysisTypeLabel(doc)}</strong>
        <small>
          {label} · {shortDate(doc.date || doc.lastEditedTime)}
        </small>
      </span>
      <b>{documentConclusion(doc)}</b>
    </button>
  );
}

function DocumentHistory({ docs, title, detail, label, onOpen }: { docs: CompanyDocument[]; title: string; detail: string; label: string; onOpen: (doc: CompanyDocument) => void }) {
  if (!docs.length) return null;
  return (
    <DisclosureSurface
      level="primary"
      className="company-history-details"
      summary={
        <>
          <span><strong>{title}</strong><small>{detail}</small></span>
          <b>Afficher</b>
        </>
      }
    >
      {docs.map((doc) => <DocumentRow key={doc.id} doc={doc} label={label} onOpen={onOpen} />)}
    </DisclosureSurface>
  );
}

function DocumentSection({ section, docs, archives = [], onOpen }: { section: CompanyTab; docs: CompanyDocument[]; archives?: CompanyDocument[]; onOpen: (doc: CompanyDocument) => void }) {
  const featured = docs[0];
  if (!featured)
    return (
      <section className="company-section-block">
        <SectionHeader eyebrow="Base Notion" title={sectionTitles[section]} description="Aucun document courant de cette catégorie n’est relié à cette entreprise." meta={<span className="analysis-total">0 courant</span>} />
        <PrimaryBlock as="article" className="company-empty-section">
          <strong>Section prête à accueillir les données Notion</strong>
          <span>Le contenu principal apparaîtra dès qu’une analyse Current sera importée et reliée.</span>
        </PrimaryBlock>
        <DocumentHistory docs={archives} title={`${archives.length} version${archives.length > 1 ? "s" : ""} archivée${archives.length > 1 ? "s" : ""}`} detail="Historique encore accessible" label="Archive" onOpen={onOpen} />
      </section>
    );
  const additionalCurrent = docs.slice(1);
  return (
    <section className={`company-section-block section-${section}`}>
      <SectionHeader eyebrow={`Base Notion · ${featured.agent}`} title={sectionTitles[section]} description="La version courante la plus récente est affichée. Les versions précédentes restent accessibles sous la fiche." meta={<span className="analysis-total">1 principale</span>} />
      <LatestInfoCard document={featured} eyebrow="Analyse courante" onOpen={() => onOpen(featured)} />
      <DocumentHistory docs={additionalCurrent} title={`${additionalCurrent.length} autre${additionalCurrent.length > 1 ? "s" : ""} document${additionalCurrent.length > 1 ? "s" : ""} courant${additionalCurrent.length > 1 ? "s" : ""}`} detail="Documents reliés à la même catégorie dans Notion" label="Current" onOpen={onOpen} />
      <DocumentHistory docs={archives} title={`${archives.length} ancienne${archives.length > 1 ? "s" : ""} version${archives.length > 1 ? "s" : ""}`} detail="Historique archivé de cette entreprise" label="Archive" onOpen={onOpen} />
      <DisclosureSurface level="primary" className="company-traceability" summary="Source et traçabilité">
        <p>Le contenu vient du snapshot Notion relié à la fiche Companies canonique. Le titre de l’entreprise n’est jamais utilisé comme clé de rapprochement.</p>
      </DisclosureSurface>
    </section>
  );
}

const refreshPresentation: Record<EarningsRefreshStatus, { label: string; tone: BadgeTone }> = {
  "not-needed": { label: "À jour", tone: "positive" },
  monitor: { label: "À surveiller", tone: "accent" },
  recommended: { label: "Refresh recommandé", tone: "warning" },
  required: { label: "Refresh requis", tone: "negative" },
  unknown: { label: "Non renseigné", tone: "neutral" },
};

function guidanceTone(value: string | null): BadgeTone {
  if (/above|raised/i.test(value ?? "")) return "positive";
  if (/below|lowered/i.test(value ?? "")) return "negative";
  if (/inline|maintained|new/i.test(value ?? "")) return "accent";
  return "neutral";
}

function EarningsReviewCard({ document, onOpen }: { document: CompanyDocument; onOpen: (doc: CompanyDocument) => void }) {
  const review = document.earningsReview;
  const period = review?.fiscalPeriod || "Période non renseignée";
  const guidance = review?.guidanceVsConsensus || review?.guidance || "Guidance non renseignée";
  const refreshes = review?.refreshes ?? [
    { key: "business", label: "Business", status: "unknown" as const, rawValue: null },
    { key: "valuation", label: "Valorisation", status: "unknown" as const, rawValue: null },
    { key: "short", label: "Short", status: "unknown" as const, rawValue: null },
    { key: "portfolio", label: "Portfolio", status: "unknown" as const, rawValue: null },
    { key: "memo", label: "Mémo CIO", status: "unknown" as const, rawValue: null },
  ];
  return (
    <PrimaryBlock as="article" className="earnings-review-card">
      <div className="earnings-review-heading">
        <div><p className="eyebrow">Dernière Earnings Review</p><h2>{period}</h2><span>Publication du {shortDate(document.date || document.lastEditedTime)}</span></div>
        <Badge tone={guidanceTone(guidance)} title={`Guidance : ${guidance}`}>{guidance}</Badge>
      </div>
      <MetadataGrid
        className="earnings-review-metadata"
        ariaLabel="Repères de la publication"
        items={[
          { label: "Période", value: period },
          { label: "Guidance", value: review?.guidance || "—" },
          { label: "Consensus", value: review?.guidanceVsConsensus || "—" },
          { label: "Confiance", value: review?.confidence || "—" },
        ]}
      />
      <section className="earnings-routing" aria-labelledby="earnings-routing-title">
        <div className="earnings-routing-title"><p className="eyebrow">Routage</p><h3 id="earnings-routing-title">Analyses à actualiser</h3></div>
        <div className="earnings-routing-grid">
          {refreshes.map((refresh) => {
            const presentation = refreshPresentation[refresh.status];
            return <SecondaryBlock className="earnings-routing-item" key={refresh.key}><span>{refresh.label}</span><Badge tone={presentation.tone} title={refresh.rawValue ?? presentation.label}>{presentation.label}</Badge></SecondaryBlock>;
          })}
        </div>
      </section>
      <ActionButton className="featured-document-open" onClick={() => onOpen(document)}>Lire la review complète</ActionButton>
    </PrimaryBlock>
  );
}

function EarningsSection({ docs, archives, onOpen }: { docs: CompanyDocument[]; archives: CompanyDocument[]; onOpen: (doc: CompanyDocument) => void }) {
  const featured = docs[0];
  if (!featured) return <DocumentSection section="earnings" docs={docs} archives={archives} onOpen={onOpen} />;
  const additional = docs.slice(1);
  return (
    <section className="company-section-block section-earnings">
      <SectionHeader eyebrow="Base Notion · Earnings" title="Earnings" description="La dernière publication analysée et son routage vers les cinq modules Investment OS." meta={<span className="analysis-total">1 principale</span>} />
      <EarningsReviewCard document={featured} onOpen={onOpen} />
      <DocumentHistory docs={additional} title={`${additional.length} autre${additional.length > 1 ? "s" : ""} review${additional.length > 1 ? "s" : ""}`} detail="Autres publications courantes reliées" label="Current" onOpen={onOpen} />
      <DocumentHistory docs={archives} title={`${archives.length} publication${archives.length > 1 ? "s" : ""} précédente${archives.length > 1 ? "s" : ""}`} detail="Historique Earnings de cette entreprise" label="Historique" onOpen={onOpen} />
    </section>
  );
}

type ResearchHighlight = {
  id: CompanyTab;
  label: string;
  document: CompanyDocument;
};

function ResearchCoverage({ items, onOpen }: { items: ResearchHighlight[]; onOpen: (document: CompanyDocument) => void }) {
  const columns: Array<DataTableColumn<ResearchHighlight>> = [
    {
      key: "analysis",
      label: "Analyse",
      className: "research-type-cell",
      render: (item) => <strong>{item.label}</strong>,
    },
    {
      key: "score",
      label: "Conclusion",
      className: "research-score-cell",
      render: (item) => documentConclusion(item.document),
    },
    {
      key: "action",
      label: "",
      className: "research-action-cell",
      render: (item) => (
        <ActionButton compact ariaLabel={`Ouvrir l’analyse ${item.label}`} onClick={() => onOpen(item.document)}>
          Ouvrir
        </ActionButton>
      ),
    },
  ];
  return <DataTable columns={columns} rows={items} getRowKey={(item) => item.id} ariaLabel="Analyses disponibles" className="research-coverage-table" />;
}

export function CompanyDetail({ companyId, close, initialData }: { companyId: string; close: () => void; initialData?: CompanyDetail }) {
  const { data: payload, loading, error, refresh } = useClientResource<{ company: CompanyDetail }>(`/api/companies/${encodeURIComponent(companyId)}`, false, initialData === undefined);
  const data = payload?.company ?? initialData;
  const [section, setSection] = useState<CompanyTab>("synthese");
  const openAnalysis = useOpenAnalysis();
  const allDocuments = useMemo(() => {
    if (!data) return [];
    const unique = new Map<string, CompanyDocument>();
    [...data.analyses, ...data.earnings, ...data.decisions, ...data.portfolioDocuments].forEach((doc) => unique.set(doc.id, doc));
    return [...unique.values()].sort((a, b) => new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime());
  }, [data]);
  const openDocument = (document: CompanyDocument) => openAnalysis(document.id);
  if (loading && !data)
    return (
      <>
        <div className="detail-navigation">
          <BackButton onBack={close} ariaLabel="Retour à la vue précédente" />
        </div>
        <PrimaryBlock as="section" className="live-portfolio-state">
          <strong>Chargement de la fiche Notion…</strong>
          <span>Récupération des propriétés, analyses et relations importées.</span>
        </PrimaryBlock>
      </>
    );
  if (!data)
    return (
      <>
        <div className="detail-navigation">
          <BackButton onBack={close} ariaLabel="Retour à la vue précédente" />
        </div>
        <PrimaryBlock as="section" className="live-portfolio-state">
          <strong>Fiche indisponible</strong><button onClick={() => void refresh()}>Réessayer</button>
          <span>{error || "Cette compagnie n’existe plus dans la base Notion."}</span>
        </PrimaryBlock>
      </>
    );
  const isMemo = (doc: CompanyDocument) => doc.sourceKey === "analyses" && (doc.category === "synthese" || /investment memo|mémo cio/i.test(`${doc.agent} ${doc.title}`));
  const grouped = (key: CompanyTab) => allDocuments.filter((doc) => key === "analyses" || (key === "memo" ? isMemo(doc) : doc.category === key && !isMemo(doc)));
  const archivedByCategory = (key: CompanyTab) => (data.archives ?? []).filter((doc) => key === "analyses" || (key === "memo" ? isMemo(doc) : doc.category === key && !isMemo(doc)));
  const title = data.name;
  const latest = allDocuments[0];
  const businessDocs = grouped("business");
  const valuationDocs = grouped("valuation");
  const researchHighlights = tabs
    .filter(([id]) => id !== "synthese" && id !== "analyses")
    .map(([id, label]) => ({ id, label, document: grouped(id)[0] }))
    .filter((item): item is ResearchHighlight => Boolean(item.document));
  return (
    <div className="company-detail generic-company-detail">
      <div className="detail-navigation">
        <BackButton onBack={close} ariaLabel="Retour à la vue précédente" />
      </div>
      {error && !initialData && <p className="resource-error" role="status">{error} La dernière fiche chargée reste affichée.</p>}
      <PrimaryBlock as="header" className="company-hero generic-company-hero">
        <div className="company-hero-main generic-company-main">
          <div className="hero-logo">{(data.ticker || title).slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="hero-title">
              <h1>{title}</h1>
              {data.ownershipStatus === "Owned" && <Badge tone="positive">Owned</Badge>}
              {data.watchlistMembership && <Badge>Watchlist</Badge>}
            </div>
            <p>{[data.ticker, data.exchange, data.sector || data.industry, data.country].filter(Boolean).join(" · ") || "Classification à compléter"}</p>
            <div className="theme-tags">
              {data.themes.slice(0, 5).map((theme) => (
                <Badge key={theme}>{theme}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="company-decision generic-company-status">
          <small>{data.watchlistMembership ? "Étape de suivi" : "État d’investissement"}</small>
          <strong>{data.watchlistMembership ? data.monitoringStatus || "Non renseignée" : data.ownershipStatus}</strong>
          <span>{data.watchlistMembership ? `Decision : ${data.decision || "Non renseignée"}` : data.researchStage || "Recherche à compléter"}</span>
        </div>
      </PrimaryBlock>
      <Tabs
        options={tabs.map(([id, label]) => ({
          value: id,
          label,
          count: id === "synthese" ? undefined : grouped(id).length,
        }))}
        value={section}
        onChange={setSection}
        ariaLabel="Sections de la fiche entreprise"
      />
      {data.ownershipStatus === "Owned" && section === "portfolio" && <LiveHoldingSummary companyId={companyId} companyName={title} detailed />}
      {section === "synthese" && (
        <>
          <section className="company-metrics">
            <StatCard
              label="Business score"
              value={
                <>
                  {data.businessScore ?? "—"}
                  <small>{data.businessScore != null ? "/100" : ""}</small>
                </>
              }
              detail={data.businessVerdict || "Non renseigné"}
            />
            <StatCard label="Analyses courantes" value={allDocuments.length} detail={`${businessDocs.length} business · ${valuationDocs.length} valorisation`} />
            <StatCard label="Couverture analyses" value={`${data.researchReferences.length}/5`} detail="Business · Valorisation · Short · PF Fit · Mémo" />
            <StatCard className="company-date" label="Dernière mise à jour" value={shortDate(data.lastAnalysis || latest?.lastEditedTime || null)} detail={latest?.agent || "Notion"} />
          </section>
          <section className="company-main-grid company-summary-grid">
            {latest ? (
              <LatestInfoCard document={latest} eyebrow="Dernière information" onOpen={() => openDocument(latest)} />
            ) : (
              <PrimaryBlock as="article" className="detail-card company-summary-primary">
                <p className="eyebrow">Dernière information</p>
                <h2>Aucune analyse reliée</h2>
                <p className="generic-empty">La structure est prête. Les analyses apparaîtront après import et relation à cette entreprise.</p>
              </PrimaryBlock>
            )}
            <section className="company-research-overview">
              <p className="eyebrow">Couverture de recherche</p>
              <h2>Analyses disponibles</h2>
              {researchHighlights.length ? <ResearchCoverage items={researchHighlights} onOpen={openDocument} /> : <p className="generic-empty">Aucune analyse courante reliée.</p>}
              <DisclosureSurface level="primary" className="company-notion-details" summary="Informations Notion">
                <div className="quality-row">
                  <span>Ticker</span>
                  <strong>{data.ticker || "—"}</strong>
                </div>
                <div className="quality-row">
                  <span>Secteur</span>
                  <strong>{data.sector || data.industry || "—"}</strong>
                </div>
                <div className="quality-row">
                  <span>Priorité</span>
                  <strong>{data.researchPriority || "—"}</strong>
                </div>
                <div className="quality-row">
                  <span>Qualité des données</span>
                  <strong>{completenessLabel(data.dataCompleteness)}</strong>
                </div>
                <a className="notion-link" href={data.notionUrl} target="_blank" rel="noreferrer">
                  Voir la fiche source ↗
                </a>
              </DisclosureSurface>
            </section>
          </section>
        </>
      )}
      {section === "portfolio" && (
        <>
          <DocumentSection section="portfolio" docs={grouped("portfolio")} archives={archivedByCategory("portfolio")} onOpen={openDocument} />
          {data.ownershipStatus !== "Owned" && (
            <PrimaryBlock as="article" className="company-empty-section">
              <strong>Cette entreprise n’est pas détenue actuellement</strong>
              <span>Elle reste consultable dans la base Companies et peut être ajoutée au portefeuille plus tard.</span>
            </PrimaryBlock>
          )}
        </>
      )}
      {section === "earnings" && <EarningsSection docs={grouped("earnings")} archives={archivedByCategory("earnings")} onOpen={openDocument} />}
      {section !== "synthese" && section !== "portfolio" && section !== "earnings" && <DocumentSection section={section} docs={grouped(section)} archives={archivedByCategory(section)} onOpen={openDocument} />}
      <footer className="company-detail-footer">
        <span>Fiche construite depuis les données Notion importées, sans réécriture du contenu source.</span>
        <a href={data.notionUrl} target="_blank" rel="noreferrer">
          Ouvrir dans Notion ↗
        </a>
      </footer>
    </div>
  );
}
