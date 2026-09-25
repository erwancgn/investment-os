"use client";

import { Activity, lazy, Suspense, useEffect, useRef } from "react";
import { useClientResource, useResourceLifecycle } from "./lib/client-resource";
import { scheduleThemeBasketWarmup } from "./lib/theme-basket-warmup";
import { OpenAnalysisContext, useAppNavigation, type Tab } from "./lib/app-navigation";
import type { LivePortfolio } from "./lib/investment-data";
import { LivePortfolioDashboard } from "./components/live-portfolio-dashboard";
import { AppPageHeader, InvestmentLogo, PortfolioPageHeader } from "./components/app-page-header";
const NotionCompanies = lazy(() => import("./components/notion-companies").then(module => ({ default: module.NotionCompanies })));
const ThemeBaskets = lazy(() => import("./components/theme-baskets").then(module => ({ default: module.ThemeBaskets })));
const CompanyDetail = lazy(() => import("./components/company-detail").then(module => ({ default: module.CompanyDetail })));
const AiAnalysis = lazy(() => import("./components/ai-analysis").then(module => ({ default: module.AiAnalysis })));
import { TargetAllocation } from "./components/target-allocation";
import { NotionSyncStatus } from "./components/notion-sync-status";
const NotionIntegrity = lazy(() => import("./components/notion-integrity").then(module => ({ default: module.NotionIntegrity })));
import { NotionBackgroundSync } from "./components/notion-background-sync";
import { GlassChrome } from "./components/ui-primitives";

const DocumentView = lazy(() => import("./components/document-view").then(module => ({ default: module.DocumentView })));
const loadingView = <div className="detail-loading" role="status" aria-live="polite">Chargement…</div>;


const tabs: { id: Tab; label: string; icon: "performance" | "company" | "baskets" | "ai" }[] = [
  { id: "portfolio", label: "Portfolio", icon: "performance" },
  { id: "companies", label: "Entreprises", icon: "company" },
  { id: "themes", label: "Thèmes", icon: "baskets" },
  { id: "ia", label: "Analyse IA", icon: "ai" },
];

function NavigationIcon({ name }: { name: typeof tabs[number]["icon"] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "performance" && <><path d="M3 3v18h18"/><path d="M8 16v-3M13 16V8M18 16V5"/></>}
    {name === "company" && <><path d="M4 21h16M6 21V5l7-2v18M13 9l5 2v10"/><path d="M9 7h.01M9 11h.01M9 15h.01M16 14h.01M16 17h.01"/></>}
    {name === "baskets" && <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>}
    {name === "ai" && <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>}
  </svg>;
}

function Header({ title, onOpenManagement }: { title: string; onOpenManagement: () => void }) {
  return <AppPageHeader title={title} onOpenManagement={onOpenManagement}/>;
}

function Portfolio({ openCompany, onOpenManagement }: { openCompany: (id?: string) => void; onOpenManagement: () => void }) {
  const { data, loading, error, refresh } = useClientResource<LivePortfolio>("/api/portfolio/live", true);
  const portfolio = data ?? null;
  const basketWarmupStarted = useRef(false);
  useEffect(() => {
    if (loading || !portfolio || portfolio.refreshPending || basketWarmupStarted.current) return;
    basketWarmupStarted.current = true;
    scheduleThemeBasketWarmup();
  }, [loading, portfolio]);
  return <>
    <PortfolioPageHeader quoteAsOf={portfolio?.quoteAsOf} loading={loading} onRefresh={() => void refresh()} onOpenManagement={onOpenManagement} />
    {error && portfolio && <p className="resource-error" role="status">{error} Les dernières données chargées restent affichées.</p>}
    <LivePortfolioDashboard data={portfolio} loading={loading} error={error} onRefresh={() => void refresh()} openCompany={openCompany} beforeDiagnostic={<TargetAllocation data={portfolio}/>}/>
    <NotionSyncStatus />
  </>;
}

function Companies({ openCompany, onOpenManagement }: { openCompany: (companyId:string, documentId?:string) => void; onOpenManagement: () => void }) {
  return <><Header title="Entreprises" onOpenManagement={onOpenManagement}/><NotionCompanies openCompany={openCompany}/></>;
}

function Themes({ onOpenManagement }: { onOpenManagement: () => void }) {
  return <><Header title="Thèmes" onOpenManagement={onOpenManagement}/><ThemeBaskets/></>;
}

function Gestion({ onOpenManagement }: { onOpenManagement: () => void }) { return <><Header title="Gestion" onOpenManagement={onOpenManagement}/><NotionIntegrity/></>; }

export default function Home(){
  useResourceLifecycle();
  const { route, visited, navigate, openCompany, openAnalysis, back } = useAppNavigation();
  const active = route.tab;
  const selectedCompany = route.company;
  const onOpenManagement = () => navigate("gestion");
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const onTabIconDoubleClick = (tab: Tab) => active === tab && !selectedCompany && !route.document ? scrollToTop : undefined;
  const content = (tab: Tab) => ({
    portfolio: <Portfolio openCompany={id => { if (id) openCompany(id); }} onOpenManagement={onOpenManagement} />,
    companies: <Companies openCompany={openCompany} onOpenManagement={onOpenManagement} />,
    themes: <Themes onOpenManagement={onOpenManagement} />,
    ia: <AiAnalysis onOpenManagement={onOpenManagement} />,
    gestion: <Gestion onOpenManagement={onOpenManagement} />,
  })[tab];
  return <OpenAnalysisContext value={openAnalysis}><main className="app-shell"><NotionBackgroundSync/><GlassChrome as="aside" className="sidebar"><div className="brand"><InvestmentLogo/><div><strong>Investment</strong><span>OS</span></div></div><nav>{tabs.map(tab=><button key={tab.id} onClick={()=>navigate(tab.id)} aria-current={active===tab.id ? "page" : undefined} className={active===tab.id?"active":""}><span className="nav-icon" onDoubleClick={onTabIconDoubleClick(tab.id)}><NavigationIcon name={tab.icon}/></span>{tab.label}</button>)}</nav><div className="sidebar-bottom"><div className="sync-card snapshot-mode"><span>◆</span><div><strong>Notion</strong><small>Snapshots documentaires</small></div><i/></div></div></GlassChrome><section className="content"><div className="content-inner">{visited.length === 0 && loadingView}{visited.map(tab => <Activity key={tab} mode={!selectedCompany && !route.document && active===tab ? "visible" : "hidden"}><div data-view={tab}><Suspense fallback={loadingView}>{content(tab)}</Suspense></div></Activity>)}
{selectedCompany && <Activity key={selectedCompany} mode={route.document ? "hidden" : "visible"}><div><Suspense fallback={loadingView}><CompanyDetail companyId={selectedCompany} close={back}/></Suspense></div></Activity>}
{route.document && <Suspense fallback={loadingView}><DocumentView key={route.document} id={route.document} onBack={back}/></Suspense>}</div></section><GlassChrome as="nav" className="mobile-nav" aria-label="Navigation principale">{tabs.map(tab=><button key={tab.id} onClick={()=>navigate(tab.id)} aria-label={tab.label} aria-current={active===tab.id ? "page" : undefined} className={active===tab.id?"active":""}><span className="nav-icon" onDoubleClick={onTabIconDoubleClick(tab.id)}><NavigationIcon name={tab.icon}/></span></button>)}</GlassChrome></main></OpenAnalysisContext>
}
