"use client";

import { Activity, lazy, Suspense, useEffect, useState, type ChangeEvent } from "react";
import { useClientResource, useResourceLifecycle } from "./lib/client-resource";
import { OpenAnalysisContext, useAppNavigation, type Tab } from "./lib/app-navigation";
import type { LivePortfolio } from "./lib/investment-data";
import { LivePortfolioDashboard } from "./components/live-portfolio-dashboard";
const NotionCompanies = lazy(() => import("./components/notion-companies").then(module => ({ default: module.NotionCompanies })));
const CompanyDetail = lazy(() => import("./components/company-detail").then(module => ({ default: module.CompanyDetail })));
const DocumentSearch = lazy(() => import("./components/document-search").then(module => ({ default: module.DocumentSearch })));
import { TargetAllocation } from "./components/target-allocation";
import { NotionSyncStatus } from "./components/notion-sync-status";
const NotionAnalyses = lazy(() => import("./components/notion-analyses").then(module => ({ default: module.NotionAnalyses })));
const NotionWatchlist = lazy(() => import("./components/notion-watchlist").then(module => ({ default: module.NotionWatchlist })));
const NotionIntegrity = lazy(() => import("./components/notion-integrity").then(module => ({ default: module.NotionIntegrity })));
import { NotionGlobalRefresh } from "./components/notion-global-refresh";
import { NotionDocumentRefresh } from "./components/notion-document-refresh";
import { NotionBackgroundSync } from "./components/notion-background-sync";
import { GlassChrome, SectionHeader } from "./components/ui-primitives";

const DocumentView = lazy(() => import("./components/document-view").then(module => ({ default: module.DocumentView })));
const loadingView = <div className="detail-loading" role="status" aria-live="polite">Chargement…</div>;


const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "portfolio", label: "Portfolio", icon: "◫" },
  { id: "watchlist", label: "Radar", icon: "◎" },
  { id: "companies", label: "Compagnies", icon: "◇" },
  { id: "analyses", label: "Analyses", icon: "▤" },
  { id: "research", label: "Recherche", icon: "⌕" },
];

function Logo() { return <div className="brand-mark"><span /><span /><span /></div>; }

const defaultAvatar = "/avatar-profile.jpeg";
const avatarStorageKey = "investment-os:profile-image";

function AccountMenu({ onOpenManagement }: { onOpenManagement: () => void }) {
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(avatarStorageKey);
      if (stored) {
        const frame = window.requestAnimationFrame(() => {
          setAvatar(stored);
          setHasCustomAvatar(true);
        });
        return () => window.cancelAnimationFrame(frame);
      }
    } catch { /* Local storage may be unavailable in private browsing. */ }
  }, []);

  const changeAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      try { window.localStorage.setItem(avatarStorageKey, reader.result); } catch { /* Keep the in-memory preview. */ }
      setAvatar(reader.result);
      setHasCustomAvatar(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const resetAvatar = () => {
    try { window.localStorage.removeItem(avatarStorageKey); } catch { /* Ignore unavailable local storage. */ }
    setAvatar(defaultAvatar);
    setHasCustomAvatar(false);
  };

  return <details className="account-menu"><summary className="avatar" aria-label="Compte Erwan"><span className="avatar-image" aria-hidden="true" style={{ backgroundImage: `url(${avatar})` }} /></summary><div className="account-menu-panel"><label className="account-menu-upload">Changer l’image<input type="file" accept="image/*" onChange={changeAvatar} /></label>{hasCustomAvatar && <button type="button" onClick={resetAvatar}>Réinitialiser l’image</button>}<button type="button" onClick={onOpenManagement}>⚙ Gestion Notion</button><small className="account-menu-note">Image enregistrée sur cet appareil</small></div></details>;
}

function Header({ title, eyebrow, onOpenManagement }: { title: string; eyebrow: string; onOpenManagement: () => void }) {
  return <SectionHeader className="page-header" heading="h1" eyebrow={eyebrow} title={title} actions={<><div className="header-account-tools"><NotionDocumentRefresh/><NotionGlobalRefresh/><AccountMenu onOpenManagement={onOpenManagement}/></div></>} />;
}

function Portfolio({ openCompany, onOpenManagement }: { openCompany: (id?: string) => void; onOpenManagement: () => void }) {
  const { data, loading, error, refresh } = useClientResource<LivePortfolio>("/api/portfolio/live", true);
  const portfolio = data ?? null;
  return <>
    <Header eyebrow="Vue consolidée" title="Portefeuille" onOpenManagement={onOpenManagement} />
    {error && portfolio && <p className="resource-error" role="status">{error} Les dernières données chargées restent affichées.</p>}
    <LivePortfolioDashboard data={portfolio} loading={loading} error={error} onRefresh={() => void refresh()} openCompany={openCompany} beforeDiagnostic={<TargetAllocation data={portfolio}/>}/>
    <NotionSyncStatus />
  </>;
}

function Watchlist({openCompany, onOpenManagement}:{openCompany:(companyId:string)=>void; onOpenManagement: () => void}) { return <><Header eyebrow="Radar d'opportunités" title="Radar" onOpenManagement={onOpenManagement}/><SectionHeader title="Convictions à suivre" description="Sociétés, thèmes et analyses actuelles issues de Notion."/><NotionWatchlist openCompany={openCompany}/></>; }

function Companies({ openCompany, onOpenManagement }: { openCompany: (companyId:string, documentId?:string) => void; onOpenManagement: () => void }) {
  return <><Header eyebrow="Base documentaire" title="Compagnies" onOpenManagement={onOpenManagement}/><NotionCompanies openCompany={openCompany}/></>;
}

function AnalysisHub({ onOpenManagement }: { onOpenManagement: () => void }) { return <><Header eyebrow="Bibliothèque de recherche" title="Analyses" onOpenManagement={onOpenManagement}/><NotionAnalyses/></>; }
function Gestion({ onOpenManagement }: { onOpenManagement: () => void }) { return <><Header eyebrow="Qualité des données" title="Gestion" onOpenManagement={onOpenManagement}/><NotionIntegrity/></>; }


function Research({openCompany, onOpenManagement}:{openCompany:(companyId:string)=>void; onOpenManagement: () => void}) { return <><Header eyebrow="Recherche documentaire" title="Recherche dans Notion" onOpenManagement={onOpenManagement}/><DocumentSearch openCompany={openCompany}/></>; }

export default function Home(){
  useResourceLifecycle();
  const { route, visited, navigate, openCompany, openAnalysis, back } = useAppNavigation();
  const active = route.tab;
  const selectedCompany = route.company;
  const onOpenManagement = () => navigate("gestion");
  const content = (tab: Tab) => ({
    portfolio: <Portfolio openCompany={id => { if (id) openCompany(id); }} onOpenManagement={onOpenManagement} />,
    watchlist: <Watchlist openCompany={openCompany} onOpenManagement={onOpenManagement} />,
    companies: <Companies openCompany={openCompany} onOpenManagement={onOpenManagement} />,
    analyses: <AnalysisHub onOpenManagement={onOpenManagement} />,
    research: <Research openCompany={openCompany} onOpenManagement={onOpenManagement} />,
    gestion: <Gestion onOpenManagement={onOpenManagement} />,
  })[tab];
  return <OpenAnalysisContext value={openAnalysis}><main className="app-shell"><NotionBackgroundSync/><GlassChrome as="aside" className="sidebar"><div className="brand"><Logo/><div><strong>Investment</strong><span>OS</span></div></div><nav>{tabs.map(tab=><button key={tab.id} onClick={()=>navigate(tab.id)} aria-current={active===tab.id ? "page" : undefined} className={active===tab.id?"active":""}><span className="nav-icon">{tab.icon}</span>{tab.label}{tab.id==="research"&&<em>TXT</em>}</button>)}</nav><div className="sidebar-bottom"><div className="sync-card snapshot-mode"><span>◆</span><div><strong>Notion</strong><small>Snapshots documentaires</small></div><i/></div></div></GlassChrome><section className="content"><div className="content-inner">{visited.length === 0 && loadingView}{visited.map(tab => <Activity key={tab} mode={!selectedCompany && !route.document && active===tab ? "visible" : "hidden"}><div data-view={tab}><Suspense fallback={loadingView}>{content(tab)}</Suspense></div></Activity>)}
{selectedCompany && <Activity key={selectedCompany} mode={route.document ? "hidden" : "visible"}><div><Suspense fallback={loadingView}><CompanyDetail companyId={selectedCompany} close={back}/></Suspense></div></Activity>}
{route.document && <Suspense fallback={loadingView}><DocumentView key={route.document} id={route.document} onBack={back}/></Suspense>}</div></section><GlassChrome as="nav" className="mobile-nav" aria-label="Navigation principale">{tabs.map(tab=><button key={tab.id} onClick={()=>navigate(tab.id)} aria-current={active===tab.id ? "page" : undefined} className={active===tab.id?"active":""}><span>{tab.icon}</span><small>{tab.label}</small></button>)}</GlassChrome></main></OpenAnalysisContext>
}
