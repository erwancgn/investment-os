"use client";

import { useMemo } from "react";
import { useClientResource } from "../lib/client-resource";
import { DisclosureSurface } from "./ui-primitives";

type SourceKey = "companies" | "analyses" | "earnings" | "portfolio" | "watchlist" | "decisions" | "sources";
type SyncRow = { source_key?: string; last_status?: string; last_completed_at?: string | null; document_count?: number };
type SyncStatus = { configured: boolean; totalDocuments: number; latestSync: string | null; sources: SyncRow[] };

const orderedSources:{key:SourceKey;label:string}[]=[
  {key:"companies",label:"Compagnies"},{key:"analyses",label:"Analyses"},{key:"earnings",label:"Earnings"},
  {key:"portfolio",label:"Portfolio"},{key:"watchlist",label:"Watchlist"},{key:"decisions",label:"Décisions"},{key:"sources",label:"Sources"},
];

function readStatus(value:unknown):SyncStatus|null{
  if(!value||typeof value!=="object")return null;
  const item=value as Partial<SyncStatus>;
  return {configured:Boolean(item.configured),totalDocuments:Number(item.totalDocuments??0),latestSync:typeof item.latestSync==="string"?item.latestSync:null,sources:Array.isArray(item.sources)?item.sources:[]};
}

export function NotionSyncStatus(){
  const { data } = useClientResource<SyncStatus>("/api/notion/status");
  const status = useMemo(() => readStatus(data), [data]);
  const states=useMemo(()=>new Map((status?.sources??[]).map(row=>[row.source_key,row])),[status]);
  const latestSync=status?.latestSync?new Date(status.latestSync).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Aucune synchronisation complète";
  const summaryMeta=status?`${status.totalDocuments} documents synchronisés · dernière synchronisation : ${latestSync}`:"Lecture de la synchronisation…";
  return <DisclosureSurface level="primary" className="notion-sync-panel" summary={<><div><p className="eyebrow">Source documentaire</p><h2>Synchronisation Notion</h2><p className="notion-sync-meta">{summaryMeta}</p></div><div className="notion-sync-actions"><span className={`freshness ${status?.configured?"live":"snapshot"}`}><i/>{status?.configured?"Webhook serveur actif":"Snapshot disponible"}</span></div></>}><div className="notion-sync-details"><p className="notion-sync-subtitle">Lecture seule · aucune synchronisation ne peut être lancée depuis le navigateur.</p><p className="notion-sync-copy">Les mises à jour sont reçues par le webhook Notion signé, puis importées côté serveur. Cette interface affiche uniquement les snapshots D1 déjà disponibles.</p><div className="notion-source-grid" aria-label="État des sources Notion">{orderedSources.map(source=>{const row=states.get(source.key);return <button type="button" key={source.key} disabled><span>{source.label}</span><strong>{Number(row?.document_count??0)} doc.</strong><small>{row?.last_status==="error"?"Erreur serveur":row?.last_completed_at?"À jour":"En attente du webhook"}</small></button>;})}</div></div></DisclosureSurface>;
}
