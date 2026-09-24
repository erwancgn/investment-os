"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

import { preloadResource } from "./client-resource";

export const tabIds = ["portfolio", "companies", "themes", "ia", "gestion"] as const;
export type Tab = typeof tabIds[number];
type Route = { tab: Tab; company: string | null; document: string | null; key: string };
type Position = { y: number; focus: HTMLElement | null };
export const OpenAnalysisContext = createContext<(id: string) => void>(() => {});
export const useOpenAnalysis = () => useContext(OpenAnalysisContext);
let sequence = 0;
const newKey = () => `${Date.now().toString(36)}-${++sequence}`;
const initial: Route = { tab: "portfolio", company: null, document: null, key: "initial" };
const viewKey = (route: Route) => `${route.tab}/${route.company ?? ""}/${route.document ?? ""}`;

export function useAppNavigation() {
  const [route, setRoute] = useState<Route>(initial);
  const [visited, setVisited] = useState<Tab[]>([]);
  const current = useRef(route);
  const positions = useRef(new Map<string, Position>());
  const views = useRef(new Map<string, Position>());
  const remember = () => {
    const position = { y: window.scrollY, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    positions.current.set(current.current.key, position);
    views.current.set(viewKey(current.current), position);
    for (const map of [positions.current, views.current]) if (map.size > 100) map.delete(map.keys().next().value!);
  };
  const apply = (next: Route) => {
    const endpoint = next.document ? `/api/analyses/${encodeURIComponent(next.document)}` : next.company ? `/api/companies/${encodeURIComponent(next.company)}` : ({portfolio:"/api/portfolio/live",companies:"/api/companies",themes:"/api/theme-baskets",ia:null,gestion:"/api/notion/integrity"})[next.tab];
    if (endpoint) preloadResource(endpoint);
    current.current = next;
    setVisited(previous => previous.includes(next.tab) ? previous : [...previous, next.tab]);
    setRoute(next);
  };
  useEffect(() => {
    history.scrollRestoration = "manual";
    const fromLocation = (): Route => {
      const params = new URLSearchParams(location.search);
      const requestedTab = params.get("tab") ?? "portfolio";
      const legacyTab = ["watchlist", "analyses", "research"].includes(requestedTab);
      const tab = legacyTab ? "companies" : tabIds.includes(requestedTab as Tab) ? requestedTab as Tab : "portfolio";
      return { tab, company: params.get("company"), document: params.get("document"), key: history.state?.investmentKey ?? newKey() };
    };
    const frame = requestAnimationFrame(() => {
      const next = fromLocation();
      const canonicalUrl = new URL(location.href);
      canonicalUrl.searchParams.set("tab", next.tab);
      history.replaceState({ ...history.state, investmentKey: next.key }, "", canonicalUrl);
      apply(next);
    });
    const pop = () => {
      remember();
      const next = fromLocation();
      const canonicalUrl = new URL(location.href);
      canonicalUrl.searchParams.set("tab", next.tab);
      history.replaceState({ ...history.state, investmentKey: next.key }, "", canonicalUrl);
      apply(next);
    };
    window.addEventListener("popstate", pop);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("popstate", pop); history.scrollRestoration = "auto"; };
  }, []);
  useLayoutEffect(() => {
    const position = positions.current.get(route.key) ?? views.current.get(viewKey(route));
    let pending = true;
    const restore = () => {
      if (!pending) return;
      window.scrollTo({ top: position?.y ?? 0, behavior: "instant" });
      if (position?.focus?.isConnected && position.focus.getClientRects().length) position.focus.focus({ preventScroll: true });
      if (Math.abs(window.scrollY - (position?.y ?? 0)) < 2) pending = false;
    };
    const cancel = () => { pending = false; };
    const frame = requestAnimationFrame(restore);
    window.addEventListener("app-view-ready", restore);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("app-view-ready", restore);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [route]);
  const move = (next: Omit<Route, "key">, replace = false) => {
    remember();
    const destination = { ...next, key: newKey() };
    const url = new URL(location.href);
    for (const name of ["tab", "company", "document"] as const) {
      if (destination[name]) url.searchParams.set(name, destination[name]!); else url.searchParams.delete(name);
    }
    url.hash = "";
    const state = { ...history.state, investmentKey: destination.key, investmentParent: replace ? null : current.current.key };
    if (replace) history.replaceState(state, "", url); else history.pushState(state, "", url);
    apply(destination);
  };
  const back = () => {
    if (history.state?.investmentParent) history.back();
    else move({ ...current.current, document: null, company: current.current.document ? current.current.company : null }, true);
  };
  return {
    route, visited, back,
    navigate: (tab: Tab) => { if (tab !== route.tab || route.company || route.document) move({ tab, company: null, document: null }); },
    openCompany: (company: string, document?: string) => move({ tab: route.tab, company, document: document ?? null }),
    openAnalysis: (document: string) => move({ ...current.current, document }),
  };
}
