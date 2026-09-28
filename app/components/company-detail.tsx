"use client";
import { useMemo, useState } from "react";
import type { CompanyDetail, CompanyDocument, CompanySectionKey, EarningsRefreshStatus } from "../lib/investment-data";
import { analysisDisplayValue, analysisTypeLabel, formatAnalysisDate } from "../lib/decision-label";
import { LiveHoldingSummary } from "./live-holding-summary";
import { useOpenAnalysis } from "../lib/app-navigation";
import { useClientResource } from "../lib/client-resource";
import { LatestInfoCard } from "./latest-info-card";
import { CompanyAnalysisDocument } from "./company-analysis-document";
import { BackButton, Badge, DisclosureSurface, MetadataGrid, PrimaryBlock, SecondaryBlock, SectionHeader, StatCard, Tabs, type BadgeTone } from "./ui-primitives";

type CompanyTab = CompanySectionKey | "memo";
const tabs: [CompanyTab, string][] = [
  ["synthese", "Synthèse"],
  ["business", "Business"],
  ["valuation", "Valuation"],
  ["risques", "Short / Risques"],
  ["portfolio", "Portfolio Fit"],
  ["memo", "Mémo CIO"],
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

function DocumentSection({ section, docs, archives = [], onOpen, demo = false }: { section: CompanyTab; docs: CompanyDocument[]; archives?: CompanyDocument[]; onOpen: (doc: CompanyDocument) => void; demo?: boolean }) {
  const featured = docs[0];
  const isDemo = demo || (featured?.id ?? archives[0]?.id ?? "").startsWith("demo-");
  if (!featured)
    return (
      <section className="company-section-block">
        <SectionHeader eyebrow={isDemo ? "Données de démonstration" : "Base Notion"} title={sectionTitles[section]} description={isDemo ? "Aucun document de démonstration de cette catégorie n’est relié à cette entreprise." : "Aucun document courant de cette catégorie n’est relié à cette entreprise."} meta={<span className="analysis-total">0 courant</span>} />
        <PrimaryBlock as="article" className="company-empty-section">
          <strong>{isDemo ? "Section de démonstration" : "Section prête à accueillir les données Notion"}</strong>
          <span>Le contenu principal apparaîtra dès qu’une analyse Current sera importée et reliée.</span>
        </PrimaryBlock>
        <DocumentHistory docs={archives} title={`${archives.length} version${archives.length > 1 ? "s" : ""} archivée${archives.length > 1 ? "s" : ""}`} detail="Historique encore accessible" label="Archive" onOpen={onOpen} />
      </section>
    );
  const additionalCurrent = docs.slice(1);
  return (
    <section className={`company-section-block section-${section}`}>
      <SectionHeader eyebrow={isDemo ? `Démonstration · ${featured.agent}` : `Base Notion · ${featured.agent}`} title={sectionTitles[section]} description={isDemo ? "Exemple fictif de la version courante. Les versions précédentes de démonstration restent accessibles sous la fiche." : "La version courante la plus récente est affichée. Les versions précédentes restent accessibles sous la fiche."} meta={<span className="analysis-total">1 principale</span>} />
      <LatestInfoCard document={featured} eyebrow="Analyse courante" onOpen={() => onOpen(featured)} />
      <DocumentHistory docs={additionalCurrent} title={`${additionalCurrent.length} autre${additionalCurrent.length > 1 ? "s" : ""} document${additionalCurrent.length > 1 ? "s" : ""} courant${additionalCurrent.length > 1 ? "s" : ""}`} detail={isDemo ? "Documents fictifs de cette catégorie" : "Documents reliés à la même catégorie dans Notion"} label="Current" onOpen={onOpen} />
      <DocumentHistory docs={archives} title={`${archives.length} ancienne${archives.length > 1 ? "s" : ""} version${archives.length > 1 ? "s" : ""}`} detail="Historique archivé de cette entreprise" label="Archive" onOpen={onOpen} />
      <DisclosureSurface level="primary" className="company-traceability" summary="Source et traçabilité">
        <p>{isDemo ? "Contenu fictif relié à cette entreprise de démonstration." : "Le contenu vient du snapshot Notion relié à la fiche Companies canonique. Le titre de l’entreprise n’est jamais utilisé comme clé de rapprochement."}</p>
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

function EarningsReviewCard({ document }: { document: CompanyDocument }) {
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
    </PrimaryBlock>
  );
}

type ResearchHighlight = {
  id: CompanyTab;
  label: string;
  document: CompanyDocument;
};

function sectionForDocument(document: CompanyDocument): CompanyTab {
  if (document.sourceKey === "decisions" || (document.sourceKey === "analyses" && (document.category === "synthese" || /investment memo|mémo cio/i.test(`${document.agent} ${document.title}`)))) return "memo";
  return document.category;
}

function ResearchCoverage({ items, onSelect }: { items: ResearchHighlight[]; onSelect: (section: CompanyTab) => void }) {
  return <div className="company-module-grid" aria-label="Analyses disponibles">{items.map(({ id, label, document: doc }) => (
    <PrimaryBlock as="button" type="button" className="company-module-card" key={id} onClick={() => onSelect(id)}>
      <span>{doc.date ? shortDate(doc.date) : shortDate(doc.lastEditedTime)} · {doc.status || "Importé"}</span>
      <strong>{label} <span aria-hidden="true">›</span></strong>
      <small>{documentConclusion(doc)}</small>
    </PrimaryBlock>
  ))}</div>;
}

export function CompanyDetail({ companyId, selectedAnalysisId = null, close, initialData }: { companyId: string; selectedAnalysisId?: string | null; close: () => void; initialData?: CompanyDetail }) {
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
  const selectedDocument = useMemo(() => selectedAnalysisId && data
    ? [...allDocuments, ...(data.archives ?? [])].find(doc => doc.id.replaceAll("-", "").toLowerCase() === selectedAnalysisId.replaceAll("-", "").toLowerCase()) ?? null
    : null, [allDocuments, data, selectedAnalysisId]);
  const activeSection = selectedDocument ? sectionForDocument(selectedDocument) : section;
  const openDocument = (document: CompanyDocument) => {
    setSection(sectionForDocument(document));
    openAnalysis(document.id);
  };
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
  const currentMemo = data.researchReferences.find(reference => reference.kind === "memo");
  const normalizeId = (id: string) => id.replaceAll("-", "").toLowerCase();
  const grouped = (key: CompanyTab) => allDocuments.filter((doc) => key === "analyses" || (key === "memo" ? Boolean(currentMemo && normalizeId(doc.id) === normalizeId(currentMemo.id)) : doc.category === key && !isMemo(doc)));
  const archivedByCategory = (key: CompanyTab) => (data.archives ?? []).filter((doc) => key === "analyses" || (key === "memo" ? isMemo(doc) : doc.category === key && !isMemo(doc)));
  const title = data.name;
  const isDemo = data.id.startsWith("demo-");
  const latest = allDocuments[0];
  const memoDoc = grouped("memo")[0];
  const latestCoreAnalysis = allDocuments
    .filter(doc => doc.category === "business" || doc.category === "valuation")
    .sort((a, b) => Date.parse(b.date || b.lastEditedTime) - Date.parse(a.date || a.lastEditedTime))[0];
  const memoTimestamp = currentMemo ? Date.parse(currentMemo.date || currentMemo.lastEditedTime) : NaN;
  const coreTimestamp = latestCoreAnalysis ? Date.parse(latestCoreAnalysis.date || latestCoreAnalysis.lastEditedTime) : NaN;
  const memoPredatesCoreAnalysis = Number.isFinite(memoTimestamp) && Number.isFinite(coreTimestamp) && memoTimestamp < coreTimestamp;
  const memoSummary = memoDoc?.previewSummaryItems?.[0] || memoDoc?.summary;
  const researchHighlights = tabs
    .filter(([id]) => id !== "synthese" && id !== "analyses")
    .map(([id, label]) => ({ id, label, document: grouped(id)[0] }))
    .filter((item): item is ResearchHighlight => Boolean(item.document));
  const selectSection = (next: CompanyTab) => {
    setSection(next);
    if (next === "synthese" || next === "analyses") {
      openAnalysis(null);
      return;
    }
    const document = grouped(next)[0];
    openAnalysis(document?.id ?? null);
  };
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
          {data.watchlistMembership && <><small>Étape de suivi Watchlist</small><strong>{data.monitoringStatus || "Non renseignée"}</strong></>}
          <small>Décision CIO · mémo Current validé</small>
          <strong>{currentMemo?.verdict || "Pas de décision CIO"}</strong>
          <span>{currentMemo ? `Mémo validé · ${formatAnalysisDate(currentMemo.date || currentMemo.lastEditedTime)}` : "Aucun mémo Current validé relié à cette entreprise."}</span>
          {memoPredatesCoreAnalysis && latestCoreAnalysis && <small>Mémo antérieur à la dernière analyse {latestCoreAnalysis.category === "business" ? "Business" : "Valuation"} ({shortDate(latestCoreAnalysis.date || latestCoreAnalysis.lastEditedTime)}).</small>}
        </div>
      </PrimaryBlock>
      <Tabs
        options={tabs.map(([id, label]) => ({
          value: id,
          label,
          count: id === "synthese" ? undefined : grouped(id).length,
        }))}
        value={activeSection}
        onChange={selectSection}
        ariaLabel="Sections de la fiche entreprise"
        panelId="company-section-panel"
      />
      <div id="company-section-panel" role="tabpanel" tabIndex={0} aria-labelledby={`company-section-panel-tab-${activeSection}`}>
      {data.ownershipStatus === "Owned" && activeSection === "portfolio" && <LiveHoldingSummary companyId={companyId} companyName={title} detailed />}
      {activeSection === "synthese" && (
        <>
          <PrimaryBlock as="section" className="company-decision-brief">
            <Badge tone={currentMemo ? "positive" : "neutral"}>{currentMemo ? "Décision du mémo CIO" : "Recherche en cours"}</Badge>
            <h2>{currentMemo?.verdict || "Pas de décision CIO"}</h2>
            <p>{currentMemo ? memoSummary || "Lire le Mémo CIO pour les arguments et conditions de revue." : "Aucun mémo Current validé relié à cette entreprise."}</p>
            {currentMemo && <small>Mémo du {shortDate(currentMemo.date || currentMemo.lastEditedTime)}{memoPredatesCoreAnalysis && latestCoreAnalysis ? ` · antérieur au dernier ${latestCoreAnalysis.category === "business" ? "Business" : "Valuation"} du ${shortDate(latestCoreAnalysis.date || latestCoreAnalysis.lastEditedTime)}` : " · conclusion historique"}</small>}
          </PrimaryBlock>
          <section className="company-metrics company-metrics--three" aria-label="Repères de la compagnie">
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
            <StatCard label="Couverture analyses" value={`${data.researchReferences.length}/5`} detail="Business · Valorisation · Short · PF Fit · Mémo" />
            <StatCard className="company-date" label="Dernière mise à jour" value={shortDate(data.lastAnalysis || latest?.lastEditedTime || null)} detail={latest?.agent || (isDemo ? "Démo" : "Notion")} />
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
              <h2>Analyses disponibles <small>{allDocuments.length} document{allDocuments.length > 1 ? "s" : ""} courant{allDocuments.length > 1 ? "s" : ""}</small></h2>
              {researchHighlights.length ? <ResearchCoverage items={researchHighlights} onSelect={selectSection} /> : <p className="generic-empty">Aucune analyse courante reliée.</p>}
              <DisclosureSurface level="primary" className="company-notion-details" summary={isDemo ? "Informations de démonstration" : "Informations Notion"}>
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
                {!isDemo && <a className="notion-link" href={data.notionUrl} target="_blank" rel="noreferrer">Voir la fiche source ↗</a>}
              </DisclosureSurface>
            </section>
          </section>
        </>
      )}
      {activeSection !== "synthese" && activeSection !== "analyses" && selectedDocument && sectionForDocument(selectedDocument) === activeSection && (
        <section className="company-section-block company-analysis-panel" aria-label={`${sectionTitles[activeSection]} · ${selectedDocument.title}`}>
          {activeSection === "earnings" && <EarningsReviewCard document={selectedDocument} />}
          <CompanyAnalysisDocument key={selectedDocument.id} preview={selectedDocument} companyName={title} />
          <DocumentHistory docs={grouped(activeSection).filter(doc => doc.id !== selectedDocument.id)} title="Autres documents courants" detail="Autres versions reliées à cette catégorie" label="Current" onOpen={openDocument} />
          <DocumentHistory docs={archivedByCategory(activeSection)} title="Versions archivées" detail="Historique de cette catégorie" label="Archive" onOpen={openDocument} />
        </section>
      )}
      {activeSection === "portfolio" && !selectedDocument && (
        <>
          <DocumentSection section="portfolio" docs={grouped("portfolio")} archives={archivedByCategory("portfolio")} onOpen={openDocument} demo={isDemo} />
          {data.ownershipStatus !== "Owned" && (
            <PrimaryBlock as="article" className="company-empty-section">
              <strong>Cette entreprise n’est pas détenue actuellement</strong>
              <span>Elle reste consultable dans la base Companies et peut être ajoutée au portefeuille plus tard.</span>
            </PrimaryBlock>
          )}
        </>
      )}
      {activeSection !== "synthese" && activeSection !== "analyses" && !selectedDocument && activeSection !== "portfolio" && <DocumentSection section={activeSection} docs={grouped(activeSection)} archives={archivedByCategory(activeSection)} onOpen={openDocument} demo={isDemo} />}
      {activeSection === "analyses" && <DocumentSection section="analyses" docs={allDocuments} archives={data.archives ?? []} onOpen={openDocument} demo={isDemo} />}
      </div>
      <footer className="company-detail-footer">
        <span>{isDemo ? "Fiche fictive fournie à titre de démonstration." : "Fiche construite depuis les données Notion importées, sans réécriture du contenu source."}</span>
        {!isDemo && <a href={data.notionUrl} target="_blank" rel="noreferrer">Ouvrir dans Notion ↗</a>}
      </footer>
    </div>
  );
}
