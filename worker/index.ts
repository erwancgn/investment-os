/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { getQuotes, instruments } from "../app/lib/quotes";
import { acquireNotionSourceSyncLock, acquireNotionSyncLock, notionSources, notionStatus, syncNotionAllSources, syncNotionSource, rebuildDocumentCompanyLinks, rebuildNotionRelations, normalizeStoredDocumentText, documentCompanyLinks, finalizeNotionImports, processNextNotionImport, processNextNotionWebhookEvent, recordNotionWebhookEvent, configureNotionWebhook, notionWebhookVerificationToken, releaseNotionSourceSyncLock, releaseNotionSyncLock, type NotionSourceKey } from "../app/lib/notion-sync";
import { getCompanyDetail, getLivePortfolio, getResearchDocument, listCompanies, listResearchDocuments, listWatchlist, searchResearchDocuments } from "../app/lib/investment-data";

import { companyPreview } from "../app/lib/company-preview";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  NOTION_TOKEN?: string;
  NOTION_WEBHOOK_SETUP_SECRET?: string;
  NOTION_SYNC_AUTH_TOKEN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function hex(bytes:ArrayBuffer){
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

function constantTimeEqual(left:string,right:string){
  if(left.length!==right.length)return false;
  let difference=0;
  for(let index=0;index<left.length;index+=1)difference|=left.charCodeAt(index)^right.charCodeAt(index);
  return difference===0;
}

async function verifyNotionWebhookSignature(rawBody:string,signature:string,verificationToken:string){
  if(!signature.startsWith("sha256="))return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(verificationToken),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(rawBody));
  return constantTimeEqual(`sha256=${hex(digest)}`,signature.toLowerCase());
}

export function authorizeNotionMutation(request:Request,env:Pick<Env,"NOTION_SYNC_AUTH_TOKEN">):Response|null{
  const expected=env.NOTION_SYNC_AUTH_TOKEN?.trim();
  if(!expected)return Response.json({error:"Synchronisation Notion serveur non configurée."},{status:503,headers:{"cache-control":"no-store"}});
  const received=request.headers.get("authorization")?.trim()??"";
  if(!constantTimeEqual(received,`Bearer ${expected}`))return Response.json({error:"Requête de synchronisation Notion non autorisée."},{status:401,headers:{"cache-control":"no-store"}});
  return null;
}

export { verifyNotionWebhookSignature };

async function drainNotionPendingWork(db:D1Database,token:string,maximumSteps=12){
  const stepLimit=Math.min(Math.max(maximumSteps,1),24);
  let webhookState:{processed?:boolean;pending?:number;failed?:number}={};
  let importState:{processed?:boolean;remaining?:number;failed?:number;needsFinalize?:boolean}={};
  let steps=0;
  let processedWebhooks=0;
  let processedImports=0;

  while(steps<stepLimit){
    webhookState=await processNextNotionWebhookEvent(db,token);
    importState=await processNextNotionImport(db,token,4);
    if(webhookState.processed)processedWebhooks+=1;
    if(importState.processed)processedImports+=1;
    steps+=1;

    const pendingWebhooks=Number(webhookState.pending??0);
    const pendingImports=Number(importState.remaining??0);
    if(pendingWebhooks===0&&pendingImports===0)break;
    if(!webhookState.processed&&!importState.processed)break;
  }

  const pendingWebhooks=Number(webhookState.pending??0);
  const failedWebhooks=Number(webhookState.failed??0);
  const pendingImports=Number(importState.remaining??0);
  const failedImports=Number(importState.failed??0);
  const canFinalize=pendingWebhooks===0&&failedWebhooks===0&&pendingImports===0&&failedImports===0&&Boolean(importState.needsFinalize);

  if(canFinalize){
    const relations=await rebuildNotionRelations(db);
    const links=await rebuildDocumentCompanyLinks(db);
    const normalized=await normalizeStoredDocumentText(db);
    const finalization=await finalizeNotionImports(db);
    return {...importState,changed:processedWebhooks>0,pendingWebhooks,steps,processedWebhooks,processedImports,pendingImports,failedWebhooks,failedImports,needsFinalize:false,relations,links,normalized,finalization};
  }

  return {...importState,changed:processedWebhooks>0,pendingWebhooks,steps,processedWebhooks,processedImports,pendingImports,failedWebhooks,failedImports,needsFinalize:Boolean(importState.needsFinalize)};
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if(url.pathname.startsWith("/api/notion/webhook/")&&request.method==="POST"){
      if(!env.NOTION_TOKEN||!env.NOTION_WEBHOOK_SETUP_SECRET)return Response.json({error:"Webhook Notion non configuré"},{status:503});
      const pathSecret=decodeURIComponent(url.pathname.slice("/api/notion/webhook/".length));
      if(!constantTimeEqual(pathSecret,env.NOTION_WEBHOOK_SETUP_SECRET))return Response.json({error:"Webhook inconnu"},{status:404});
      const rawBody=await request.text();
      let payload:{verification_token?:string;id?:string;timestamp?:string;type?:string;entity?:{id?:string;type?:string}};
      try{payload=JSON.parse(rawBody);}catch{return Response.json({error:"Payload webhook invalide"},{status:400});}
      if(typeof payload.verification_token==="string"){
        try{
          await configureNotionWebhook(env.DB,payload.verification_token);
          return Response.json({verified:true},{headers:{"cache-control":"no-store"}});
        }catch(error){
          return Response.json({error:error instanceof Error?error.message:"Vérification webhook impossible"},{status:409});
        }
      }
      const verificationToken=await notionWebhookVerificationToken(env.DB);
      if(!verificationToken)return Response.json({error:"Abonnement webhook non vérifié"},{status:428});
      const signature=request.headers.get("x-notion-signature")??"";
      if(!await verifyNotionWebhookSignature(rawBody,signature,verificationToken))return Response.json({error:"Signature webhook invalide"},{status:401});
      try{
        const recorded=await recordNotionWebhookEvent(env.DB,payload,rawBody);
        ctx.waitUntil((async()=>{
          try{
            await drainNotionPendingWork(env.DB,env.NOTION_TOKEN!,12);
          }catch(error){console.error("Webhook Notion queued for retry",error);}
        })());
        return Response.json({...recorded,queued:true},{status:202,headers:{"cache-control":"no-store"}});
      }catch(error){
        return Response.json({error:error instanceof Error?error.message:"Événement webhook invalide"},{status:400});
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/quotes") {
      const raw=(url.searchParams.get("assets")||"").split(",").filter(Boolean);
      const ids=[...new Set(raw)].filter(id=>id in instruments).slice(0,20);
      if(!ids.length)return Response.json({error:"Aucun actif valide"},{status:400});
      const force=url.searchParams.get("refresh")==="1";
      const quotes=await getQuotes(ids,force,env.DB);
      return Response.json({generatedAt:new Date().toISOString(),quotes:Object.fromEntries(quotes.map(q=>[q.assetId,q])),partial:quotes.some(q=>q.nativePrice===null)},{headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/notion/status" && request.method === "GET") {
      return Response.json(await notionStatus(env.DB, Boolean(env.NOTION_TOKEN)), { headers: { "cache-control": "no-store" } });
    }

    if(url.pathname==="/api/notion/webhook-verification"&&request.method==="GET"){
      return Response.json({error:"Cette route n'est pas exposée."},{status:410,headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/companies" && request.method === "GET") {
      return Response.json({companies:await listCompanies(env.DB)},{headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/watchlist" && request.method === "GET") {
      return Response.json(await listWatchlist(env.DB),{headers:{"cache-control":"no-store"}});
    }

    if (url.pathname.startsWith("/api/companies/") && request.method === "GET") {
      const companyId=decodeURIComponent(url.pathname.slice("/api/companies/".length));
      const company=await getCompanyDetail(env.DB,companyId);
      return company?Response.json({company:companyPreview(company)},{headers:{"cache-control":"no-store"}}):Response.json({error:"Compagnie introuvable"},{status:404});
    }

    if (url.pathname === "/api/analyses" && request.method === "GET") {
      const documents=await listResearchDocuments(env.DB);
      return Response.json({documents,counts:{total:documents.length,active:documents.filter(item=>!item.archived).length,archived:documents.filter(item=>item.archived).length,analyses:documents.filter(item=>item.sourceKey==="analyses"&&!item.archived).length,earnings:documents.filter(item=>item.sourceKey==="earnings"&&!item.archived).length,portfolio:documents.filter(item=>item.sourceKey==="portfolio"&&!item.archived).length,decisions:documents.filter(item=>item.sourceKey==="decisions"&&!item.archived).length}},{headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/archives" && request.method === "GET") {
      const documents=await listResearchDocuments(env.DB);
      const archived=documents.filter(item=>item.archived);
      return Response.json({documents:archived,count:archived.length},{headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/notion/integrity" && request.method === "GET") {
      const [companies,documents,companyLinks,watchlist]=await Promise.all([listCompanies(env.DB),listResearchDocuments(env.DB),documentCompanyLinks(env.DB),listWatchlist(env.DB)]);
      const orphanDocuments=documents.filter(document=>document.companyName==="Non relié");
      const multiCompanyDocuments=documents.filter(document=>new Set(companyLinks.get(document.id)??[]).size>1);
      const missingCurrent=companies.filter(company=>company.researchReferences.length<5);
      const archived=documents.filter(document=>document.archived);
      const currentAudit=companies.map(company=>({id:company.id,name:company.name,owned:company.ownershipStatus==="Owned",watchlist:company.watchlistMembership,resolved:company.researchReferences.map(reference=>reference.kind),missing:["business","valuation","short","portfolio","memo"].filter(kind=>!company.researchReferences.some(reference=>reference.kind===kind))}));
      const watchlistCurrent=currentAudit.filter(item=>item.watchlist);
      const watchlistMissingCompany=watchlist.items.filter(item=>item.companyIds.length===0);
      const watchlistMultipleCompanies=watchlist.items.filter(item=>item.companyIds.length>1);
      const companyOccurrences=new Map<string,number>();
      for(const item of watchlist.items)for(const companyId of new Set(item.companyIds))companyOccurrences.set(companyId,(companyOccurrences.get(companyId)??0)+1);
      const duplicateWatchlistCompanies=[...companyOccurrences.values()].filter(count=>count>1).length;
      return Response.json({generatedAt:new Date().toISOString(),key:"canonical Notion page ID (UUID compact, title never used as identity)",counts:{companies:companies.length,documents:documents.length,activeDocuments:documents.length-archived.length,archivedDocuments:archived.length,relationEdges:documents.reduce((sum,document)=>sum+document.relations.length,0),orphanDocuments:orphanDocuments.length,multiCompanyDocuments:multiCompanyDocuments.length,missingCurrent:missingCurrent.length,watchlistCompanies:watchlistCurrent.length,watchlistMissingCompany:watchlistMissingCompany.length,watchlistMultipleCompanies:watchlistMultipleCompanies.length,duplicateWatchlistCompanies},orphanDocuments:orphanDocuments.slice(0,50).map(document=>({id:document.id,title:document.title,companyName:document.companyName,sourceKey:document.sourceKey,notionUrl:document.notionUrl})),multiCompanyDocuments:multiCompanyDocuments.slice(0,50).map(document=>({id:document.id,title:document.title,companyName:document.companyName,notionUrl:document.notionUrl})),missingCurrent:missingCurrent.slice(0,50).map(company=>({id:company.id,name:company.name,notionUrl:company.notionUrl})),watchlistIssues:{missingCompany:watchlistMissingCompany.map(item=>({id:item.id,name:item.name,notionUrl:item.notionUrl})),multipleCompanies:watchlistMultipleCompanies.map(item=>({id:item.id,name:item.name,notionUrl:item.notionUrl}))},currentAudit,currentAuditWatchlist:watchlistCurrent},{headers:{"cache-control":"private, no-store"}});
    }

    if (url.pathname.startsWith("/api/analyses/") && request.method === "GET") {
      const pageId=decodeURIComponent(url.pathname.slice("/api/analyses/".length));
      const document=await getResearchDocument(env.DB,pageId);
      return document?Response.json({document},{headers:{"cache-control":"no-store"}}):Response.json({error:"Analyse introuvable"},{status:404});
    }

    if (url.pathname === "/api/portfolio/live" && request.method === "GET") {
      try{return Response.json(await getLivePortfolio(env.DB,url.searchParams.get("refresh")==="1",url.searchParams.get("refresh")!=="1"),{headers:{"cache-control":"no-store"}})}catch(error){return Response.json({error:error instanceof Error?error.message:"Calcul du portefeuille impossible"},{status:502})}
    }

    if (url.pathname === "/api/notion/search" && request.method === "GET") {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 160);
      const result = await searchResearchDocuments(env.DB, query, {
        source: url.searchParams.get("source") ?? "all",
        freshness: url.searchParams.get("freshness") ?? "current",
        limit: Number(url.searchParams.get("limit") ?? 20),
        offset: Number(url.searchParams.get("offset") ?? 0),
      });
      return Response.json(result, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/notion/sync" && request.method === "POST") {
      const authorizationError=authorizeNotionMutation(request,env);
      if(authorizationError)return authorizationError;
      if (!env.NOTION_TOKEN) return Response.json({ error: "NOTION_TOKEN n'est pas configuré." }, { status: 503 });
      const body = await request.json().catch(() => ({})) as { source?: string; maximumPages?: number; forceFull?: boolean; rebuild?: boolean };
      const source = body.source;
      if (!source || !(source in notionSources)) return Response.json({ error: "Source Notion invalide." }, { status: 400 });
      // Keep every mobile request short. Repeated calls resume naturally because
      // unchanged pages are detected from D1 and skipped.
      const maximumPages = Math.min(Math.max(Number(body.maximumPages ?? 8), 1), source === "portfolio" ? 100 : 12);
      const sourceKey = source as NotionSourceKey;
      const lock = await acquireNotionSourceSyncLock(env.DB, sourceKey, sourceKey === "portfolio" ? 15_000 : 30_000);
      if (!lock.acquired) return Response.json({ error: `La base ${source} est déjà en cours de synchronisation.` }, { status: 409 });
      try {
        const result = await syncNotionSource(env.DB, env.NOTION_TOKEN, sourceKey, maximumPages, Boolean(body.forceFull));
        return Response.json(result,{headers:{"cache-control":"no-store"}});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Échec de la synchronisation Notion";
        return Response.json({ error: message }, { status: 502 });
      } finally {
        await releaseNotionSourceSyncLock(env.DB, sourceKey, lock.owner);
      }
    }

    if(url.pathname==="/api/notion/import-next"&&request.method==="POST"){
      const authorizationError=authorizeNotionMutation(request,env);
      if(authorizationError)return authorizationError;
      if(!env.NOTION_TOKEN)return Response.json({error:"NOTION_TOKEN n'est pas configuré."},{status:503});
      return Response.json(await drainNotionPendingWork(env.DB,env.NOTION_TOKEN,1),{headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/notion/sync-background" && request.method === "POST") {
      const authorizationError=authorizeNotionMutation(request,env);
      if(authorizationError)return authorizationError;
      if (!env.NOTION_TOKEN) return Response.json({ error: "NOTION_TOKEN n'est pas configuré." }, { status: 503 });
      const body = await request.json().catch(() => ({})) as { forceFull?: boolean };
      const forceFull = Boolean(body.forceFull) || url.searchParams.get("force") === "1";
      const status=await notionStatus(env.DB,true);
      const cacheFresh=!forceFull&&status.metadataCacheFresh;
      const pendingWork=status.queue.remaining>0||status.webhook.pending>0||status.queue.needsFinalize;
      const failedWork=status.queue.failed>0||status.webhook.failed>0;
      if (cacheFresh&&!pendingWork&&!failedWork) return Response.json({ accepted: false, skipped: true, reason: "notion-cache-fresh" }, { headers: { "cache-control": "no-store" } });
      const lock = await acquireNotionSyncLock(env.DB, 90_000);
      if (!lock.acquired) return Response.json({ accepted: false, running: true }, { status: 202 });
      ctx.waitUntil((async () => {
        try {
          if(!cacheFresh||forceFull||failedWork)await syncNotionAllSources(env.DB,env.NOTION_TOKEN!,100,false);
          await drainNotionPendingWork(env.DB,env.NOTION_TOKEN!,12);
        } catch (error) {
          // The per-source sync state keeps the actionable error. The launch
          // request itself has already returned, so never reject waitUntil.
          console.error("Background Notion sync failed", error);
        } finally {
          await releaseNotionSyncLock(env.DB, lock.owner);
        }
      })());
      return Response.json({ accepted: true, running: true, forceFull }, { status: 202, headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/notion/sync-portfolio" && request.method === "POST") {
      const authorizationError=authorizeNotionMutation(request,env);
      if(authorizationError)return authorizationError;
      if (!env.NOTION_TOKEN) return Response.json({ error: "NOTION_TOKEN n'est pas configuré." }, { status: 503 });
      const force = url.searchParams.get("force") === "1";
      const state = await env.DB.prepare("SELECT last_status,last_completed_at FROM notion_sync_state WHERE source_key='portfolio'").first<{last_status:string;last_completed_at:string|null}>();
      const lastCompleted = state?.last_completed_at ? Date.parse(state.last_completed_at) : NaN;
      const cacheFresh = Number.isFinite(lastCompleted) && Date.now() - lastCompleted < 60 * 60 * 1000;
      if (!force && cacheFresh && state?.last_status === "success") {
        return Response.json({ accepted: false, skipped: true, reason: "portfolio-cache-fresh", lastCompletedAt: state.last_completed_at }, { headers: { "cache-control": "no-store" } });
      }
      const lock = await acquireNotionSyncLock(env.DB);
      if (!lock.acquired) return Response.json({ accepted: false, running: true }, { status: 202 });
      ctx.waitUntil((async () => {
        try {
          // Portfolio is deliberately refreshed as one small source. The
          // importer reads every row so quantity, account, PRU and Status
          // changes are all detected, including sold positions.
          await syncNotionSource(env.DB, env.NOTION_TOKEN!, "portfolio", 100, true);
          await rebuildNotionRelations(env.DB);
          await rebuildDocumentCompanyLinks(env.DB);
          await normalizeStoredDocumentText(env.DB);
        } catch (error) {
          console.error("Background Portfolio sync failed", error);
        } finally {
          await releaseNotionSyncLock(env.DB, lock.owner);
        }
      })());
      return Response.json({ accepted: true, running: true, force }, { status: 202, headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/notion/sync-all" && request.method === "POST") {
      const authorizationError=authorizeNotionMutation(request,env);
      if(authorizationError)return authorizationError;
      if (!env.NOTION_TOKEN) return Response.json({ error: "NOTION_TOKEN n'est pas configuré." }, { status: 503 });
      const body = await request.json().catch(() => ({})) as { maximumPages?: number; forceFull?: boolean };
      const maximumPages = Math.min(Math.max(Number(body.maximumPages ?? 8), 1), 100);
      const lock = await acquireNotionSyncLock(env.DB);
      if (!lock.acquired) return Response.json({ error: "Une synchronisation Notion est déjà en cours." }, { status: 409 });
      try {
        const result = await syncNotionAllSources(env.DB, env.NOTION_TOKEN, maximumPages, Boolean(body.forceFull));
        return Response.json(result,{headers:{"cache-control":"no-store"}});
      } catch (error) {
        const message = error instanceof Error ? error.message : "Échec de la mise à jour Notion";
        return Response.json({ error: message }, { status: 502 });
      } finally {
        await releaseNotionSyncLock(env.DB, lock.owner);
      }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
