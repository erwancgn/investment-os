/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { instruments } from "../app/lib/quotes";
import { acquireNotionSourceSyncLock, acquireNotionSyncLock, notionSources, notionStatus, syncNotionAllSources, syncNotionSource, rebuildDocumentCompanyLinks, rebuildNotionRelations, normalizeStoredDocumentText, documentCompanyLinks, finalizeNotionImports, processNextNotionImport, processNextNotionWebhookEvent, recordNotionWebhookEvent, configureNotionWebhook, notionWebhookVerificationToken, releaseNotionSourceSyncLock, releaseNotionSyncLock, type NotionSourceKey } from "../app/lib/notion-sync";
import { auditCompanyWatchlistRelations, listCompanies } from "../app/lib/investment-data";
import { createInvestmentService, createInvestmentReadAdapter } from "../adapters/notion/investment-reads";

import { createMcpHandler } from "../transports/mcp/server";
import { authenticateSitesMcp } from "../transports/mcp/sites-auth";
import { createDemoInvestmentService } from "../adapters/demo/investment-reads";

import { companyPreview } from "../app/lib/company-preview";
import { getThemeBaskets, parseBasketOptions } from "../app/lib/theme-baskets";
import { getDemoCompanies, getDemoCompanyDetail, getDemoLivePortfolio, getDemoResearchDocument, getDemoThemeBaskets } from "../app/lib/demo-data";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  NOTION_TOKEN?: string;
  NOTION_WEBHOOK_SETUP_SECRET?: string;
  NOTION_SYNC_AUTH_TOKEN?: string;
  /** Email address of the Site owner, set as a private runtime variable. */
  OWNER_EMAIL?: string;
  MCP_WRITE_ENABLED?: string;
  MCP_WRITE_DELEGATED?: string;
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

const SCOPE_COOKIE = "investment-os-scope";
type AppScope = "demo" | "personal";

/**
 * Sites injects this identity header after authenticating a visitor. Never use
 * a browser supplied scope or cookie as proof of identity; the cookie only
 * remembers the owner's UI preference.
 */
export function hasOwnerIdentity(request: Request, env: Pick<Env, "OWNER_EMAIL">): boolean {
  const configuredOwner = env.OWNER_EMAIL?.trim().toLowerCase();
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return Boolean(configuredOwner && authenticatedEmail && configuredOwner === authenticatedEmail);
}

function requestedScope(request: Request, owner: boolean): AppScope {
  if (!owner) return "demo";
  const preference = request.headers.get("cookie")?.split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return name === SCOPE_COOKIE ? value.join("=") : undefined;
  }).find((value) => value !== undefined);
  return preference === "personal" ? "personal" : "demo";
}

function scopeCookie(scope: AppScope): string {
  return `${SCOPE_COOKIE}=${scope}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

function privateScopeDenied(): Response {
  return Response.json({ error: "Cette ressource est réservée à l'espace personnel." }, { status: 403, headers: { "cache-control": "private, no-store" } });
}

function authorizeOwnerPrivateBrowserMutation(request:Request):Response|null{
  const url=new URL(request.url);
  const origin=request.headers.get("origin");
  const fetchSite=request.headers.get("sec-fetch-site");
  const action=request.headers.get("x-investment-os-action");
  if(origin!==url.origin||fetchSite&&fetchSite!=="same-origin"||action!=="notion-refresh"){
    return Response.json({error:"Requête de mise à jour documentaire refusée."},{status:403,headers:{"cache-control":"no-store"}});
  }
  return null;
}

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

async function launchNotionRefresh(env:Env,ctx:ExecutionContext,{forceScan=false}:{forceScan?:boolean}={}){
  if(!env.NOTION_TOKEN)return Response.json({error:"NOTION_TOKEN n'est pas configuré."},{status:503});
  const status=await notionStatus(env.DB,true);
  const pendingWork=status.queue.remaining>0||status.webhook.pending>0||status.queue.needsFinalize;
  const failedWork=status.queue.failed>0||status.webhook.failed>0;
  const shouldScan=forceScan||!status.metadataCacheFresh||failedWork;
  if(!shouldScan&&!pendingWork)return Response.json({accepted:false,skipped:true,reason:"notion-cache-fresh"},{headers:{"cache-control":"no-store"}});
  const lock=await acquireNotionSyncLock(env.DB,90_000);
  if(!lock.acquired)return Response.json({accepted:false,running:true},{status:202,headers:{"cache-control":"no-store"}});
  const acceptedAt=new Date().toISOString();
  ctx.waitUntil((async()=>{
    try{
      if(shouldScan)await syncNotionAllSources(env.DB,env.NOTION_TOKEN!,100,false);
      await drainNotionPendingWork(env.DB,env.NOTION_TOKEN!,12);
    }catch(error){
      console.error("Background Notion sync failed",error);
    }finally{
      await releaseNotionSyncLock(env.DB,lock.owner);
    }
  })());
  return Response.json({accepted:true,running:true,forceScan,acceptedAt},{status:202,headers:{"cache-control":"no-store"}});
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

// One handler per Worker isolate: retain active WRITE fences beyond response deadlines.
const mcpHandlers = new WeakMap<Env, ReturnType<typeof createMcpHandler>>();
function mcpHandler(env: Env) {
  let mcp = mcpHandlers.get(env);
  if (!mcp) {
    mcp = createMcpHandler({
      authenticate: request => authenticateSitesMcp(request, env),
      service: scope => scope === "demo" ? createDemoInvestmentService() : createInvestmentService(env.DB, env.NOTION_TOKEN ? { token: env.NOTION_TOKEN } : undefined),
    });
    mcpHandlers.set(env, mcp);
  }
  return mcp;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/openai-apps-challenge" && request.method === "GET") {
      return new Response("mpJR0O_0nS7S-EeztZzEmb3vDetAaOaA2jyVm67yHCo", {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" },
      });
    }
    if (url.pathname === "/mcp") return mcpHandler(env)(request, task => ctx.waitUntil(task));
    const owner = hasOwnerIdentity(request, env);
    const scope = requestedScope(request, owner);

    if (url.pathname === "/api/session" && request.method === "GET") {
      return Response.json({ scope, canAccessPersonal: owner }, { headers: { "cache-control": "private, no-store", "vary": "cookie, oai-authenticated-user-email" } });
    }

    if (url.pathname === "/api/session" && request.method === "POST") {
      if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") {
        return Response.json({ error: "Requête de session refusée." }, { status: 403, headers: { "cache-control": "no-store" } });
      }
      const body = await request.json().catch(() => ({})) as { scope?: unknown };
      if (body.scope !== "demo" && body.scope !== "personal") {
        return Response.json({ error: "Espace demandé invalide." }, { status: 400, headers: { "cache-control": "no-store" } });
      }
      if (body.scope === "personal" && !owner) return privateScopeDenied();
      const nextScope = body.scope as AppScope;
      const headers = new Headers({ "cache-control": "private, no-store", "vary": "cookie, oai-authenticated-user-email" });
      if (owner) headers.append("set-cookie", scopeCookie(nextScope));
      return Response.json({ scope: nextScope, canAccessPersonal: owner }, { headers });
    }

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
        fetchAsset: (path) => {
          let decodedPath: string;
          try { decodedPath = decodeURIComponent(path); } catch { return Promise.resolve(new Response(null, { status: 404 })); }
          // Only the two public SVG brand assets are legitimate local image
          // sources. The optimizer cannot be used to probe API or user files.
          if (decodedPath !== "/openai-mark.svg" && decodedPath !== "/favicon.svg") return Promise.resolve(new Response(null, { status: 404 }));
          return env.ASSETS.fetch(new Request(new URL(decodedPath, request.url)));
        },
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/quotes") {
      if (!owner || scope !== "personal") return privateScopeDenied();
      const raw=(url.searchParams.get("assets")||"").split(",").filter(Boolean);
      const ids=[...new Set(raw)].filter(id=>id in instruments).slice(0,20);
      if(!ids.length)return Response.json({error:"Aucun actif valide"},{status:400});
      const force=url.searchParams.get("refresh")==="1";
      const quotes=await createInvestmentReadAdapter(env.DB).getQuotes(ids,{force});
      return Response.json({generatedAt:new Date().toISOString(),quotes:Object.fromEntries(quotes.map(q=>[q.assetId,q])),partial:quotes.some(q=>q.nativePrice===null)},{headers:{"cache-control":"private, no-store"}});
    }

    if (url.pathname === "/api/notion/status" && request.method === "GET") {
      if (!owner || scope !== "personal") return Response.json({ configured: false }, { headers: { "cache-control": "no-store" } });
      return Response.json(await notionStatus(env.DB, Boolean(env.NOTION_TOKEN)), { headers: { "cache-control": "private, no-store" } });
    }

    if(url.pathname==="/api/notion/refresh"&&request.method==="POST"){
      if (!owner || scope !== "personal") return privateScopeDenied();
      const authorizationError=authorizeOwnerPrivateBrowserMutation(request);
      if(authorizationError)return authorizationError;
      // This route inherits the owner-private Sites perimeter used by all
      // sensitive read APIs. The browser never receives NOTION_SYNC_AUTH_TOKEN.
      return launchNotionRefresh(env,ctx,{forceScan:true});
    }

    if(url.pathname==="/api/notion/webhook-verification"&&request.method==="GET"){
      return Response.json({error:"Cette route n'est pas exposée."},{status:410,headers:{"cache-control":"no-store"}});
    }

    if (url.pathname === "/api/companies" && request.method === "GET") {
      if (scope === "demo") return Response.json(getDemoCompanies(), { headers: { "cache-control": "no-store" } });
      if (!owner) return privateScopeDenied();
      return Response.json({companies:await listCompanies(env.DB)},{headers:{"cache-control":"private, no-store"}});
    }

    if (url.pathname === "/api/theme-baskets" && request.method === "GET") {
      const options = parseBasketOptions(url.searchParams);
      if (scope === "demo") return Response.json(getDemoThemeBaskets(options), { headers: { "cache-control": "no-store" } });
      if (!owner) return privateScopeDenied();
      try{return Response.json(await getThemeBaskets(env.DB,options),{headers:{"cache-control":"private, no-store"}})}
      catch(error){return Response.json({error:error instanceof Error?error.message:"Calcul des paniers impossible"},{status:502,headers:{"cache-control":"no-store"}})}
    }

    if (url.pathname.startsWith("/api/companies/") && request.method === "GET") {
      const companyId=decodeURIComponent(url.pathname.slice("/api/companies/".length));
      if (scope === "demo") {
        const company = getDemoCompanyDetail(companyId);
        return company ? Response.json({ company: companyPreview(company.company) }, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "Compagnie introuvable" }, { status: 404, headers: { "cache-control": "no-store" } });
      }
      if (!owner) return privateScopeDenied();
      const company=await createInvestmentReadAdapter(env.DB).getCompany(companyId);
      return company?Response.json({company},{headers:{"cache-control":"private, no-store"}}):Response.json({error:"Compagnie introuvable"},{status:404,headers:{"cache-control":"private, no-store"}});
    }

    if (url.pathname === "/api/notion/integrity" && request.method === "GET") {
      if (!owner || scope !== "personal") return privateScopeDenied();
      const [companies,documents,companyLinks,watchlistAudit]=await Promise.all([listCompanies(env.DB),createInvestmentReadAdapter(env.DB).listAnalysesForIntegrity(),documentCompanyLinks(env.DB),auditCompanyWatchlistRelations(env.DB)]);
      const orphanDocuments=documents.filter(document=>document.companyName==="Non relié");
      const multiCompanyDocuments=documents.filter(document=>new Set(companyLinks.get(document.id)??[]).size>1);
      const missingCurrent=companies.filter(company=>company.researchReferences.length<5);
      const archived=documents.filter(document=>document.archived);
      const currentAudit=companies.map(company=>({id:company.id,name:company.name,owned:company.ownershipStatus==="Owned",watchlist:company.watchlistMembership,resolved:company.researchReferences.map(reference=>reference.kind),missing:["business","valuation","short","portfolio","memo"].filter(kind=>!company.researchReferences.some(reference=>reference.kind===kind))}));
      const presentationQuality={valid:documents.filter(document=>document.presentationStatus==="valid").length,absent:documents.filter(document=>document.presentationStatus==="absent").length,invalid:documents.filter(document=>document.presentationStatus==="invalid").length,issues:documents.filter(document=>document.presentationStatus==="invalid").slice(0,50).map(document=>({id:document.id,title:document.title,sourceKey:document.sourceKey,error:document.presentationError??"Projection invalide."}))};
      const watchlistCurrent=currentAudit.filter(item=>item.watchlist);
      return Response.json({generatedAt:new Date().toISOString(),key:"canonical Notion page ID (UUID compact, title never used as identity)",counts:{companies:companies.length,ownedCompanies:currentAudit.filter(item=>item.owned).length,documents:documents.length,activeDocuments:documents.length-archived.length,archivedDocuments:archived.length,relationEdges:documents.reduce((sum,document)=>sum+document.relations.length,0),orphanDocuments:orphanDocuments.length,multiCompanyDocuments:multiCompanyDocuments.length,missingCurrent:missingCurrent.length,watchlistCompanies:watchlistCurrent.length,watchlistMissingCompany:watchlistAudit.missingCompany.length,watchlistMultipleCompanies:watchlistAudit.multipleCompanies.length,duplicateWatchlistCompanies:watchlistAudit.duplicateCompanies.length,watchlistStatusWithoutEntry:watchlistAudit.statusWithoutWatchlist.length},presentationQuality,orphanDocuments:orphanDocuments.slice(0,50).map(document=>({id:document.id,title:document.title,companyName:document.companyName,sourceKey:document.sourceKey,notionUrl:document.notionUrl})),multiCompanyDocuments:multiCompanyDocuments.slice(0,50).map(document=>({id:document.id,title:document.title,companyName:document.companyName,notionUrl:document.notionUrl})),missingCurrent:missingCurrent.slice(0,50).map(company=>({id:company.id,name:company.name,notionUrl:company.notionUrl})),watchlistIssues:{...watchlistAudit,missingCompany:watchlistAudit.missingCompany.slice(0,50),multipleCompanies:watchlistAudit.multipleCompanies.slice(0,50),duplicateCompanies:watchlistAudit.duplicateCompanies.slice(0,50),statusWithoutWatchlist:watchlistAudit.statusWithoutWatchlist.slice(0,50)},currentAudit,currentAuditWatchlist:watchlistCurrent},{headers:{"cache-control":"private, no-store"}});
    }

    if (url.pathname.startsWith("/api/analyses/") && request.method === "GET") {
      const started=performance.now();
      const requestId=crypto.randomUUID();
      const readHeaders=()=>({"cache-control":"private, no-store","x-request-id":requestId,"server-timing":`app;dur=${(performance.now()-started).toFixed(1)}`});
      if (scope === "demo") {
        let pageId:string;
        try{pageId=decodeURIComponent(url.pathname.slice("/api/analyses/".length));}
        catch{return Response.json({error:"Analyse introuvable."},{status:404,headers:{"cache-control":"no-store"}});}
        const document = getDemoResearchDocument(pageId);
        return document ? Response.json(document, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "Analyse introuvable" }, { status: 404, headers: { "cache-control": "no-store" } });
      }
      if (!owner) return privateScopeDenied();
      let pageId:string;
      try{pageId=decodeURIComponent(url.pathname.slice("/api/analyses/".length));}
      catch{return Response.json({error:"Identifiant d’analyse invalide.",code:"invalid_input",stage:"input",requestId},{status:400,headers:readHeaders()});}
      try{
        const document=await createInvestmentReadAdapter(env.DB).getAnalysisById(pageId);
        return document?Response.json({document},{headers:readHeaders()}):Response.json({error:"Analyse introuvable",code:"analysis_not_found",stage:"lookup",requestId},{status:404,headers:readHeaders()});
      }catch(error){
        const tagged=error&&typeof error==="object"?error as {code?:unknown;stage?:unknown}:{};
        const causeName=error instanceof Error?error.name:"";
        const timedOut=tagged.code==="timeout"||causeName==="TimeoutError"||causeName==="AbortError";
        const code=tagged.code==="normalization"?"normalization":tagged.code==="mapping"?"mapping":timedOut?"timeout":"storage";
        const stage=typeof tagged.stage==="string"?tagged.stage:code==="normalization"?"normalization":"read";
        const durationMs=Number((performance.now()-started).toFixed(1));
        console.error(JSON.stringify({event:"analysis-read-failed",id:requestId,code,stage,durationMs}));
        return Response.json({error:"Lecture de l’analyse indisponible. Réessaie dans un instant.",code,stage,requestId},{status:500,headers:readHeaders()});
      }
    }

    if (url.pathname === "/api/portfolio/live" && request.method === "GET") {
      if (scope === "demo") return Response.json(getDemoLivePortfolio(), { headers: { "cache-control": "no-store" } });
      if (!owner) return privateScopeDenied();
      try{return Response.json(await createInvestmentReadAdapter(env.DB).getPortfolio({force:url.searchParams.get("refresh")==="1",cacheOnly:url.searchParams.get("refresh")!=="1"}),{headers:{"cache-control":"private, no-store"}})}catch(error){return Response.json({error:error instanceof Error?error.message:"Calcul du portefeuille impossible"},{status:502,headers:{"cache-control":"private, no-store"}})}
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
      const forceScan = Boolean(body.forceFull) || url.searchParams.get("force") === "1";
      return launchNotionRefresh(env,ctx,{forceScan});
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

    // Do not fall through unknown API paths to the framework router. The
    // Worker owns the data API namespace and unknown routes must stay closed.
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Route API introuvable." }, { status: 404, headers: { "cache-control": "no-store" } });
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
