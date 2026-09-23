"use client";

import { useMemo } from "react";
import { useClientResource } from "../lib/client-resource";
import { DisclosureSurface } from "./ui-primitives";

type SourceKey = "companies" | "analyses" | "earnings" | "portfolio" | "watchlist" | "decisions" | "sources";
type SyncRow = { source_key?: string; last_status?: string; last_completed_at?: string | null; document_count?: number };
type SyncStatus = {
  configured: boolean;
  totalDocuments: number;
  latestSync: string | null;
  queue?: { remaining?: number; failed?: number; needsFinalize?: boolean };
  webhook?: { pending?: number; failed?: number };
  sources: SyncRow[];
};

const orderedSources:{key:SourceKey;label:string}[]=[
  {key:"companies",label:"Entreprises"},{key:"analyses",label:"Analyses"},{key:"earnings",label:"Earnings"},
  {key:"portfolio",label:"Portfolio"},{key:"watchlist",label:"Watchlist"},{key:"decisions",label:"Décisions"},{key:"sources",label:"Sources"},
];

function readStatus(value:unknown):SyncStatus|null{
  if(!value||typeof value!=="object")return null;
  const item=value as Partial<SyncStatus>;
  return {configured:Boolean(item.configured),totalDocuments:Number(item.totalDocuments??0),latestSync:typeof item.latestSync==="string"?item.latestSync:null,queue:item.queue,webhook:item.webhook,sources:Array.isArray(item.sources)?item.sources:[]};
}

export function NotionSyncStatus(){
  const { data } = useClientResource<SyncStatus>("/api/notion/status");
  const status = useMemo(() => readStatus(data), [data]);
  const states=useMemo(()=>new Map((status?.sources??[]).map(row=>[row.source_key,row])),[status]);
  const pending=Number(status?.queue?.remaining??0)+Number(status?.webhook?.pending??0);
  const failed=Number(status?.queue?.failed??0)+Number(status?.webhook?.failed??0);
  const syncing=pending>0||Boolean(status?.queue?.needsFinalize)||(status?.sources??[]).some(row=>["discovering","pending","imported"].includes(row.last_status??""));
  const latestSync=status?.latestSync?new Date(status.latestSync).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Aucune synchronisation complète";
  const summaryMeta=status?`${status.totalDocuments} documents synchronisés · dernière synchronisation : ${latestSync}`:"Lecture de la synchronisation…";
  const globalLabel=failed>0?"Erreur de synchronisation":syncing?"Synchronisation en cours":status?.configured?"Webhook serveur actif":"Snapshot disponible";
  return <DisclosureSurface level="primary" className="notion-sync-panel" summary={<><div><p className="eyebrow">Source documentaire</p><h2>Synchronisation Notion</h2><p className="notion-sync-meta">{summaryMeta}</p></div><div className="notion-sync-actions"><span className={`freshness ${failed>0?"snapshot":status?.configured?"live":"snapshot"}`}><i/>{globalLabel}</span></div></>}><div className="notion-sync-details"><p className="notion-sync-subtitle">Les mises à jour Notion sont importées côté serveur puis publiées dans les snapshots D1.</p><p className="notion-sync-copy">{failed>0?`${failed} tâche${failed>1?"s":""} en erreur.`:syncing?(pending>0?`${pending} tâche${pending>1?"s":""} encore en traitement.`:"Découverte des mises à jour en cours."):"Les snapshots documentaires disponibles sont à jour avec la dernière synchronisation terminée."}</p><div className="notion-source-grid" aria-label="État des sources Notion">{orderedSources.map(source=>{const row=states.get(source.key);const rowStatus=row?.last_status==="error"?"Erreur serveur":["discovering","pending","imported"].includes(row?.last_status??"")?"Synchronisation…":row?.last_completed_at?"À jour":"En attente du webhook";return <button type="button" key={source.key} disabled><span>{source.label}</span><strong>{Number(row?.document_count??0)} doc.</strong><small>{rowStatus}</small></button>;})}</div></div></DisclosureSurface>;
}
