import { normalizeAnalysisDocument, type NormalizedAnalysisDocument } from "../../app/lib/document-presentation";
import { getQuotes, type QuoteView } from "../../app/lib/quotes";
import { calculatePortfolioAggregates } from "../../core/portfolio";
import type { CurrentAnalysisFamily, CurrentSelectionInput } from "../../core/analysis/current-selection";
import type { AnalysisFamily } from "../../core/contracts/analysis";
import { documentCompanyLinks, documentPrimaryCompanyLinks, ensureRelationTable, normalizeNotionPageId, snapshotPlainText } from "./sync";
import { humanReadableNotionBlocks, type AnalysisPresentationProjection, type ProjectionStatus, verifyPresentationProjection } from "../../app/lib/presentation-projection";

type JsonRecord = Record<string, unknown>;
type StoredDocument = { page_id: string; title: string; notion_url: string; properties_json: string };
const record = (value: unknown): JsonRecord => value && typeof value === "object" ? value as JsonRecord : {};
const rich = (value: unknown) => Array.isArray(value) ? value.map(item => String(record(item).plain_text ?? "")).join("") : "";
const normalizedPropertyName = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[;,.:_/-]+/g, " ").replace(/\s+/g, " ").trim();
export function propertyName(properties:JsonRecord,names:string[]):string|undefined {
  for(const name of names){
    if(properties[name])return name;
    const wanted=normalizedPropertyName(name);
    const found=Object.keys(properties).find(key=>normalizedPropertyName(key)===wanted);
    if(found)return found;
  }
  return undefined;
}
export function propertyEntry(properties:JsonRecord,name:string):JsonRecord {
  return record(properties[propertyName(properties,[name])??""]);
}

export function propertyValue(properties: JsonRecord, name: string): unknown {
  const property = propertyEntry(properties, name); const type = String(property.type ?? ""); const value = property[type];
  if (type === "title" || type === "rich_text") return rich(value);
  if (type === "select" || type === "status") return record(value).name ?? null;
  if (type === "multi_select") return Array.isArray(value) ? value.map(item => String(record(item).name ?? "")).filter(Boolean) : [];
  if (["number", "checkbox", "url", "email"].includes(type)) return value ?? null;
  if (type === "date") return record(value).start ?? null;
  if (type === "relation") return Array.isArray(value) ? value.map(item => String(record(item).id ?? "")).filter(Boolean) : [];
  if (type === "formula" || type === "rollup") { const inner = record(value); return inner[String(inner.type ?? "")] ?? null; }
  return null;
}
// Rows are request-local. Weak keys release parsed properties with their rows.
const parsedProperties = new WeakMap<object, { source: string; value: JsonRecord }>();
function props(row: Pick<StoredDocument,"properties_json">) {
  const cached = parsedProperties.get(row);
  if (cached?.source === row.properties_json) return cached.value;
  let value: JsonRecord;
  try { value = record(JSON.parse(row.properties_json)); } catch { value = {}; }
  parsedProperties.set(row, { source: row.properties_json, value });
  return value;
}
function numeric(value: unknown) { if (value == null || value === "") return null; const result = Number(value); return Number.isFinite(result) ? result : null; }
export const cleanPositionName = (value: string) => value.replace(/\s+[—–-]\s+(?:CTO|PEA)\s*$/i, "").trim();
const normalizedName = (value:string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const isCashName = (name:string, instrumentType:string) => instrumentType.toLowerCase() === "cash" || name.toLowerCase().startsWith("cash");
const isClosedPortfolioRow = (properties:JsonRecord) => /^(sold|vendu|vendue|closed|inactive|archived|archive|archivée)$/i.test(String(propertyValue(properties,"Status") ?? "").trim());
const countryLabels:Record<string,string>={
  "United States":"États-Unis", "Taiwan":"Taïwan", "Japan":"Japon", "Netherlands":"Pays-Bas",
  "South Korea":"Corée du Sud", "Germany":"Allemagne", "China":"Chine", "Israel":"Israël",
  "France":"France", "United Kingdom":"Royaume-Uni", "Italy":"Italie", "Switzerland":"Suisse",
  "Canada":"Canada", "Australia":"Australie", "Hong Kong":"Hong Kong", "Singapore":"Singapour",
};
function displayCountry(value:string):string{
  const normalized=value.trim();
  if(!normalized||/cash|derivative|other/i.test(normalized))return "Autres";
  return countryLabels[normalized]??normalized;
}
function relationIds(properties:JsonRecord, names:string[]):string[] { return [...new Set(names.flatMap(name => ((propertyValue(properties,name) as string[]) ?? []).map(normalizeNotionPageId).filter(Boolean)))]; }
function allRelationIds(properties:JsonRecord):string[] { return [...new Set(Object.values(properties).flatMap(property => { const item=record(property); return item.type === "relation" && Array.isArray(item.relation) ? item.relation.map(relation=>normalizeNotionPageId(String(record(relation).id??""))).filter(Boolean) : []; }))]; }
function activePortfolioCompanyIds(rows:Pick<StoredDocument,"properties_json">[]):Set<string> {
  const companyIds=new Set<string>();
  for(const row of rows){
    const properties=props(row);
    const isActive=String(propertyValue(properties,"Status")??"").trim().toLowerCase()==="active";
    const quantity=numeric(propertyValue(properties,"Quantity"))??0;
    if(!isActive||quantity<=0)continue;
    for(const id of relationIds(properties,["Company","Companies"]))companyIds.add(id);
  }
  return companyIds;
}
function monitoringStatusFor(properties:JsonRecord):string {
  const canonical=String(propertyValue(properties,"Monitoring Status")??"").trim();
  if(canonical==="To deepen")return "To analyse";
  if(canonical)return canonical;
  const legacy=String(propertyValue(properties,"Statut")??"").trim();
  if(legacy==="Watch")return "Monitoring";
  if(legacy==="À approfondir")return "To analyse";
  if(legacy==="Prête à acheter")return "Ready to buy";
  if(legacy==="Écartée")return "Excluded";
  return legacy;
}

export type ResearchReferenceKind = "business"|"valuation"|"short"|"portfolio"|"memo";
export type ResearchReference = { id:string; kind:ResearchReferenceKind; title:string; agent:string; score:string; verdict:string; confidence:string|null; status:string; date:string|null; lastEditedTime:string; notionUrl:string };
export type CompanyListItem = { id:string; name:string; ticker:string; sector:string; industry:string; ownershipStatus:"Owned"|"Not owned"; watchlistMembership:boolean; monitoringStatus:string; businessScore:number|null; businessVerdict:string; researchStage:string; researchPriority:string; lastAnalysis:string|null; themes:string[]; country:string; currency:string; exchange:string; dataCompleteness:string; notionUrl:string; researchReferences:ResearchReference[] };
const referenceProperties:Record<ResearchReferenceKind,string>={business:"Current Business Analysis",valuation:"Current Valuation Analysis",short:"Current Short Analysis",portfolio:"Current Portfolio Analysis",memo:"Current Investment Memo"};
function referenceKind(agent:string):ResearchReferenceKind|null { const value=agent.toLowerCase(); if(value.includes("business"))return "business";if(value.includes("valuation"))return "valuation";if(value.includes("short"))return "short";if(value.includes("portfolio"))return "portfolio";if(value.includes("memo"))return "memo";return null; }
type ArchivePolicy = { archivedIds:Set<string>; activeIds:Set<string> };
function explicitlyArchived(row:Pick<StoredContentDocument,"title"|"properties_json">):boolean {
  const status=String(propertyValue(props(row),"Status")??"");
  return /superseded|archiv|obsolet|obsolete|historique|historical|remplac/i.test(`${status} ${row.title}`);
}
function freshnessRank(row:StoredContentDocument):number {
  const freshness=String(propertyValue(props(row),"Source Freshness")??"").trim().toLowerCase();
  const status=String(propertyValue(props(row),"Status")??"").trim().toLowerCase();
  return (freshness==="current"?2:0)+(status==="validated"?1:0);
}
function analysisTimestamp(row:StoredContentDocument):number {
  const p=props(row);
  const candidates=[propertyValue(p,"Analysis Date"),propertyValue(p,"Date"),propertyValue(p,"Decision Date"),propertyValue(p,"Earnings Date"),row.last_edited_time]
    .map(value=>value?new Date(String(value)).getTime():NaN).filter(Number.isFinite);
  return candidates.length?Math.max(...candidates):0;
}
function companyRowName(row:StoredDocument):string { const properties=props(row); return String(propertyValue(properties,"Company")??row.title); }
function documentCompanyIds(row:StoredContentDocument, companyRows:StoredDocument[], primaryLinks:Map<string,string[]>):string[] {
  // Only explicit Notion company relations and title ownership are allowed to
  // decide a fiche's owner.  Content matches and secondary many-to-many edges
  // are intentionally excluded: a BESI mention in an NVIDIA note must not
  // make that note an Advantest/BESI current analysis.
  const rowId=normalizeNotionPageId(row.page_id);
  const indexed=primaryLinks.get(rowId)??[];
  if(indexed.length)return [...new Set(indexed.map(normalizeNotionPageId))];
  const ids=new Set<string>();
  const companyIds=new Set(companyRows.map(company=>normalizeNotionPageId(company.page_id)));
  for(const id of allRelationIds(props(row))) if(companyIds.has(id)) ids.add(id);
  const hay=` ${normalizedName(row.title)} `;
  for(const company of companyRows){
    const name=normalizedName(companyRowName(company));
    const ticker=normalizedName(String(propertyValue(props(company),"Ticker")??""));
    const aliases=[name,ticker].filter(alias=>alias.length>=3);
    if(aliases.some(alias=>hay.includes(` ${alias} `))) ids.add(normalizeNotionPageId(company.page_id));
  }
  return [...ids];
}
function buildArchivePolicy(rows:StoredContentDocument[], companyRows:StoredDocument[], primaryLinks:Map<string,string[]>, currentIds:Set<string>):ArchivePolicy {
  const archivedIds=new Set<string>(rows.filter(explicitlyArchived).map(row=>normalizeNotionPageId(row.page_id)));
  const activeIds=new Set<string>();
  const groups=new Map<string,StoredContentDocument[]>();
  for(const row of rows){
    const companyIds=documentCompanyIds(row,companyRows,primaryLinks);
    const category=classifyDocument(row.source_key,row.title,row.plain_text,props(row));
    for(const companyId of companyIds){
      const key=`${normalizeNotionPageId(companyId)}::${category}`;
      groups.set(key,[...(groups.get(key)??[]),row]);
    }
  }
  for(const candidates of groups.values()){
    const freshValidated=candidates.filter(row=>freshnessRank(row)>=3);
    const validated=candidates.filter(row=>String(propertyValue(props(row),"Status")??"").trim().toLowerCase()==="validated");
    const preferred=freshValidated.length?freshValidated:(validated.length?validated:candidates);
    const usable=preferred.filter(row=>!explicitlyArchived(row)||freshnessRank(row)>=3);
    const pool=usable.length?usable:candidates;
    const latest=[...pool].sort((a,b)=>{
      const freshnessDelta=freshnessRank(b)-freshnessRank(a);
      if(freshnessDelta!==0)return freshnessDelta;
      const delta=analysisTimestamp(b)-analysisTimestamp(a);
      if(Number.isFinite(delta)&&delta!==0)return delta;
      return currentIds.has(normalizeNotionPageId(b.page_id))?1:-1;
    })[0];
    if(latest){ activeIds.add(normalizeNotionPageId(latest.page_id)); archivedIds.delete(normalizeNotionPageId(latest.page_id)); }
    for(const row of candidates) if(normalizeNotionPageId(row.page_id)!==normalizeNotionPageId(latest?.page_id ?? "")) archivedIds.add(normalizeNotionPageId(row.page_id));
  }
  return {archivedIds,activeIds};
}
type CompanyReadContext = {
  companyRows?: StoredDocument[];
  portfolioRows?: Pick<StoredDocument, "properties_json">[];
  analysisRows?: StoredContentDocument[];
  primaryLinks?: Map<string, string[]>;
  companyId?: string;
  archivePolicy?: ArchivePolicy;
};
export async function listCompanies(db: D1Database, includeReferences = true, context: CompanyReadContext = {}): Promise<CompanyListItem[]> {
  const [companyResult,portfolioResult,watchlistResult]=await Promise.all([
    context.companyRows ? Promise.resolve({results:context.companyRows}) : db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='companies' ORDER BY title COLLATE NOCASE").all<StoredDocument>(),
    context.portfolioRows ? Promise.resolve({results:context.portfolioRows}) : db.prepare("SELECT properties_json FROM notion_documents WHERE source_key='portfolio'").all<Pick<StoredDocument,"properties_json">>(),
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='watchlist'").all<StoredDocument>(),
  ]);
  const rows=companyResult.results??[];
  const ownedCompanyIds=activePortfolioCompanyIds(portfolioResult.results??[]);
  const watchlistRows=watchlistResult.results??[];
  const primaryLinks=context.primaryLinks ?? await documentPrimaryCompanyLinks(db);
  const watchlistCompanyIds=new Set(watchlistRows.flatMap(row=>relationIds(props(row),["Company","Companies"])));
  const watchlistStateByCompany=new Map<string,string>();
  const conflictingWatchlistCompanyIds=new Set<string>();
  for(const row of watchlistRows){
    const p=props(row);
    const state=monitoringStatusFor(p);
    const companyIds=relationIds(p,["Company","Companies"]);
    for(const companyId of companyIds){
      if(watchlistStateByCompany.has(companyId)){ conflictingWatchlistCompanyIds.add(companyId); watchlistStateByCompany.delete(companyId); }
      else if(!conflictingWatchlistCompanyIds.has(companyId)) watchlistStateByCompany.set(companyId,state);
    }
  }
  const analysisRows=includeReferences?(context.analysisRows ?? (await db.prepare("SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,500) AS plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio') ORDER BY last_edited_time DESC").all<StoredContentDocument>()).results??[]):[];
  const canonical=currentCompanyDocumentLinks(rows);
  const currentIds=currentDocumentIds(rows);
  const policy=context.archivePolicy ?? buildArchivePolicy(analysisRows,rows,primaryLinks,currentIds);
  // Work with canonical IDs inside this projection. The DB may contain legacy
  // dashed UUIDs while a fresh Notion relation contains the compact form.
  const analyses=await Promise.all(analysisRows.map(async row=>{const canonicalRow={...row,page_id:normalizeNotionPageId(row.page_id)};return {row:canonicalRow,doc:await documentFromRow(canonicalRow,[],currentIds,policy),properties:props(row)};}));
  return rows.filter(row => !context.companyId || normalizeNotionPageId(row.page_id) === context.companyId).map(row => {
    const p = props(row);
    const owned=ownedCompanyIds.has(normalizeNotionPageId(row.page_id));
    const watchlistMembership=watchlistCompanyIds.has(normalizeNotionPageId(row.page_id));
    const companyAnalysisIds=allRelationIds(p);
    const related=analyses.filter(item=>{
      if(item.doc.archived)return false;
      const category=item.doc.category;
      const canonicalIds=canonicalIdsForCategory(canonical,row.page_id,category);
      // A populated Current relation is authoritative for that section. This
      // prevents a document that merely mentions another company from being
      // selected as the fiche's latest analysis.
      if(canonicalIds.size)return canonicalIds.has(item.row.page_id);
      return companyAnalysisIds.includes(normalizeNotionPageId(item.row.page_id))||(primaryLinks.get(normalizeNotionPageId(item.row.page_id))??[]).includes(normalizeNotionPageId(row.page_id));
    });
    const researchReferences=(Object.entries(referenceProperties) as [ResearchReferenceKind,string][]).flatMap(([kind,property])=>{
      const preferred=relationIds(p,[property]);
      const category=currentReferenceCategories[kind];
      const canonicalIds=canonicalIdsForCategory(canonical,row.page_id,category);
      const candidate=kind === "memo"
        ? related.find(item=>preferred.includes(normalizeNotionPageId(item.row.page_id))&&relationIds(item.properties,["Company","Companies"]).includes(normalizeNotionPageId(row.page_id))&&item.doc.status.trim().toLowerCase()==="validated"&&String(propertyValue(item.properties,"Agent")??"").trim().toLowerCase()==="investment memo")
        : related.find(item=>preferred.includes(normalizeNotionPageId(item.row.page_id)))
        ?? related.find(item=>canonicalIds.has(normalizeNotionPageId(item.row.page_id)))
        ?? related.find(item=>referenceKind(item.doc.agent)===kind&&item.doc.status.toLowerCase()==="validated")
        ?? related.find(item=>referenceKind(item.doc.agent)===kind);
      if(!candidate)return[];
      return [{id:candidate.doc.id,kind,title:candidate.doc.title,agent:candidate.doc.agent,score:candidate.doc.score,verdict:candidate.doc.verdict,confidence:candidate.doc.confidence,status:candidate.doc.status,date:candidate.doc.date,lastEditedTime:candidate.doc.lastEditedTime,notionUrl:candidate.doc.notionUrl}];
    });
    return { id:row.page_id, name:String(propertyValue(p,"Company") ?? row.title), ticker:String(propertyValue(p,"Ticker") ?? ""), sector:String(propertyValue(p,"Sector") ?? ""), industry:String(propertyValue(p,"Industry") ?? ""), ownershipStatus:owned ? "Owned" : "Not owned", watchlistMembership, monitoringStatus:watchlistStateByCompany.get(normalizeNotionPageId(row.page_id)) ?? "", businessScore:numeric(propertyValue(p,"Business Score")), businessVerdict:String(propertyValue(p,"Business Verdict") ?? ""), researchStage:String(propertyValue(p,"Research Stage") ?? ""), researchPriority:String(propertyValue(p,"Research Priority") ?? ""), lastAnalysis:propertyValue(p,"Last Analysis") as string|null, themes:(propertyValue(p,"Themes") as string[]) ?? [], country:String(propertyValue(p,"Country") ?? ""), currency:String(propertyValue(p,"Currency") ?? ""), exchange:String(propertyValue(p,"Exchange") ?? ""), dataCompleteness:String(propertyValue(p,"Data Completeness") ?? ""), notionUrl:row.notion_url, researchReferences };
  });
}

export type WatchlistRelationAudit = {
  missingCompany: { id:string; name:string; notionUrl:string }[];
  multipleCompanies: { id:string; name:string; notionUrl:string; companyIds:string[] }[];
  duplicateCompanies: { id:string; name:string; notionUrl:string; watchlistIds:string[] }[];
  statusWithoutWatchlist: { id:string; name:string; notionUrl:string }[];
};
export async function auditCompanyWatchlistRelations(db:D1Database):Promise<WatchlistRelationAudit>{
  const [watchlistResult,companyResult]=await Promise.all([
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='watchlist' ORDER BY title COLLATE NOCASE").all<StoredDocument>(),
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='companies' ORDER BY title COLLATE NOCASE").all<StoredDocument>(),
  ]);
  const watchlist=(watchlistResult.results??[]).map(row=>({row,companyIds:relationIds(props(row),["Company","Companies"])}));
  const byCompany=new Map<string,typeof watchlist>();
  for(const item of watchlist)for(const companyId of new Set(item.companyIds))byCompany.set(companyId,[...(byCompany.get(companyId)??[]),item]);
  const missingCompany=watchlist.filter(item=>item.companyIds.length===0).map(({row})=>({id:row.page_id,name:row.title,notionUrl:row.notion_url}));
  const multipleCompanies=watchlist.filter(item=>item.companyIds.length>1).map(({row,companyIds})=>({id:row.page_id,name:row.title,notionUrl:row.notion_url,companyIds}));
  const duplicateCompanies=(companyResult.results??[]).flatMap(row=>{const id=normalizeNotionPageId(row.page_id);const linked=byCompany.get(id)??[];return linked.length>1?[{id:row.page_id,name:row.title,notionUrl:row.notion_url,watchlistIds:linked.map(item=>item.row.page_id)}]:[];});
  const statusWithoutWatchlist=(companyResult.results??[]).filter(row=>String(propertyValue(props(row),"Status")??"").trim().toLowerCase()==="watchlist"&&!byCompany.has(normalizeNotionPageId(row.page_id))).map(row=>({id:row.page_id,name:row.title,notionUrl:row.notion_url}));
  return{missingCompany,multipleCompanies,duplicateCompanies,statusWithoutWatchlist};
}

const quoteByPosition: Record<string,string> = { "Advantest":"advantest", "Air Liquide":"air", "Alphabet A":"googl", "Amazon":"amzn", "BE Semiconductor Industries":"besi", "Bitcoin":"btc", "BNP Easy S&P 500":"ese", "Lumentum Holdings":"lite", "Microsoft":"msft", "MSCI Global Semiconductor USD Acc":"sec0", "Nebius Group":"nbis", "NVIDIA":"nvda", "S&P Global":"spgi", "Schneider Electric":"su", "STMicroelectronics":"stm", "TSMC ADR":"tsm", "Uber Technologies":"uber", "Visa":"visa" };
const targetAliases: Record<string,string> = { "BNP Easy S&P 500":"ese", "Alphabet A":"googl", "BE Semiconductor Industries":"besi", "MSCI Global Semiconductor USD Acc":"sec0", "Nebius Group":"nbis", "TSMC ADR":"tsm", "STMicroelectronics":"stm", "Cash":"cash", "Cash CTO":"cash", "Cash PEA":"cash" };
const targetLabels:Record<string,string>={advantest:"Advantest",air:"Air Liquide",amzn:"Amazon",besi:"BESI",btc:"Bitcoin",cash:"Cash",ese:"S&P 500",googl:"Alphabet",lite:"Lumentum",msft:"Microsoft",nbis:"Nebius",nvda:"NVIDIA",sec0:"ETF semi",spgi:"S&P Global",stm:"STMicroelectronics",su:"Schneider Electric",tsm:"TSMC",uber:"Uber",visa:"Visa"};
export type LivePositionExposure = { name:string; weight:number };
export type LivePosition = { id:string; targetId:string; name:string; instrumentType:string; account:string; sector:string; industry:string; themes:string[]; primaryTheme:string; country:string|null; countryExposures:LivePositionExposure[]; sectorExposures:LivePositionExposure[]; themeExposures:LivePositionExposure[]; quantity:number; pruEur:number|null; brokerPruEur:number|null; pruSource:"notion-pru"|"notion-broker-pru"|"missing"; costBasisEur:number; brokerCostBasisEur:number; marketValueEur:number|null; pnlEur:number|null; pnlPercent:number|null; brokerPnlEur:number|null; brokerPnlPercent:number|null; weight:number|null; targetWeight:number; targetEur:number; target10kWeight:number; target10kEur:number; quoteSymbol:string|null; nativePrice:number|null; nativeCurrency:string; eurPrice:number|null; fxRate:number|null; fxMarketTime:string|null; fetchedAt:string|null; quoteWarnings:string[]; changePercent:number|null; quoteSource:string; quoteFreshness:string; marketTime:string|null; companyIds:string[]; notionUrl:string; warning:string|null };
export type CompanySectionKey = "synthese"|"portfolio"|"business"|"valuation"|"risques"|"earnings"|"analyses";
export type RelationLink = { id:string; title:string; url:string; property:string; sourceKey:string|null };
export type DecisionFields = {
  action:string|null;
  outcome:string|null;
  account:string|null;
  instrumentType:string|null;
  currentWeight:string|null;
  maximumWeight:string|null;
  maximumEntryPrice:string|null;
  nextReview:string|null;
  confidence:string|null;
  coreThesis:string|null;
  entryCondition:string|null;
  executionPlan:string|null;
  fundingSource:string|null;
  catalyst:string|null;
  invalidationCriteria:string|null;
  keyRisk:string|null;
  reviewTrigger:string|null;
};
export type EarningsRefreshStatus = "not-needed"|"monitor"|"recommended"|"required"|"unknown";
export type EarningsRefreshItem = { key:"business"|"valuation"|"short"|"portfolio"|"memo"; label:string; status:EarningsRefreshStatus; rawValue:string|null };
export type EarningsReviewFields = { fiscalPeriod:string|null; guidance:string|null; guidanceVsConsensus:string|null; confidence:string|null; refreshes:EarningsRefreshItem[] };
export type CompanyDocument = { normalizedAnalysis?:NormalizedAnalysisDocument; previewSummaryItems?:string[]; id:string; title:string; sourceKey:string; category:CompanySectionKey; agent:string; notionUrl:string; lastEditedTime:string; plainText:string; notionBlocks?:unknown[]; presentationProjection?:AnalysisPresentationProjection|null; presentationStatus?:ProjectionStatus; presentationError?:string|null; summary:string|null; handoffSummary:string|null; status:string; score:string; verdict:string; confidence:string|null; date:string|null; relations:RelationLink[]; archived:boolean; current:boolean; decision?:DecisionFields|null; earningsReview?:EarningsReviewFields|null };
export type ResearchDocument = CompanyDocument & { companyName:string };
export type CompanyDetail = CompanyListItem & { analyses:CompanyDocument[]; earnings:CompanyDocument[]; decisions:CompanyDocument[]; portfolioDocuments:CompanyDocument[]; archives:CompanyDocument[] };
type StoredContentDocument = StoredDocument & { source_key:string; last_edited_time:string; plain_text:string; blocks_json?:string };
function classifyDocument(sourceKey:string,title:string,plainText:string,properties:JsonRecord={}):CompanySectionKey {
  // The Agent select is the canonical type in the Analyses database.  Use it
  // before content heuristics: a business/valuation note can legitimately
  // mention "decision", "bear" or "portfolio" without changing its section.
  const agent=String(propertyValue(properties,"Agent")??"").toLowerCase();
  if(sourceKey==="earnings"||agent.includes("earnings")||agent.includes("earning"))return "earnings";
  if(agent.includes("valuation"))return "valuation";
  if(agent.includes("short"))return "risques";
  if(agent.includes("portfolio"))return "portfolio";
  if(agent.includes("memo")||agent.includes("investment memo"))return "synthese";
  if(agent.includes("business"))return "business";
  if(sourceKey==="portfolio")return "portfolio";
  if(sourceKey==="decisions")return "synthese";
  const hay=`${title} ${plainText.slice(0,500)}`.toLowerCase();
  if(/earnings|résultat|results|guidance|quarter|q[1-4]/i.test(hay))return "earnings";
  if(/valuation|valorisation|fair value|multiple|reverse valuation/i.test(hay))return "valuation";
  if(/short seller|short check|forensic|bear case|invalidation/i.test(hay))return "risques";
  if(/portfolio check|portfolio manager|allocation|cible|target weight/i.test(hay))return "portfolio";
  if(/investment memo|memo cio|decision memo|décision/i.test(hay))return "synthese";
  if(/business check|business analyst|moat|modèle économique|business model/i.test(hay))return "business";
  return "analyses";
}
function agentFor(category:CompanySectionKey,sourceKey:string):string { if(category==="business")return "Business Analyst"; if(category==="valuation")return "Valuation Analyst"; if(category==="risques")return "Short Seller"; if(category==="portfolio")return "Portfolio Manager"; if(category==="synthese")return "Investment Memo"; if(category==="earnings")return "Earnings"; return sourceKey; }
async function relationMap(db:D1Database, sourcePageIds?:string[]):Promise<Map<string,RelationLink[]>> {
  await ensureRelationTable(db);
  const map=new Map<string,RelationLink[]>();
  const addRows=(rows:{source_page_id:string;target_page_id:string;property_name:string;target_source_key:string|null;title:string|null;notion_url:string|null}[])=>{
    for(const row of rows){
      const sourceId=normalizeNotionPageId(row.source_page_id);
      const targetId=normalizeNotionPageId(row.target_page_id);
      const current=map.get(sourceId)??[];
      current.push({id:targetId,title:row.title??"Page Notion",url:row.notion_url??`https://www.notion.so/${targetId}`,property:row.property_name,sourceKey:row.target_source_key});
      map.set(sourceId,current);
    }
  };
  if(sourcePageIds===undefined){
    const rows=(await db.prepare("SELECT source_page_id,target_page_id,property_name,target_source_key FROM notion_relations ORDER BY property_name").all<{source_page_id:string;target_page_id:string;property_name:string;target_source_key:string|null}>()).results??[];
    const documents=(await db.prepare("SELECT page_id,title,notion_url FROM notion_documents").all<{page_id:string;title:string;notion_url:string}>()).results??[];
    const byId=new Map(documents.map(doc=>[normalizeNotionPageId(doc.page_id),doc]));
    addRows(rows.map(row=>({...row,title:byId.get(normalizeNotionPageId(row.target_page_id))?.title??null,notion_url:byId.get(normalizeNotionPageId(row.target_page_id))?.notion_url??null})));
    return map;
  }
  const scopedIds=[...new Set(sourcePageIds.flatMap(id=>{
    const canonical=normalizeNotionPageId(id);
    if(!canonical)return [];
    if(!/^[0-9a-f]{32}$/i.test(canonical))return [id,canonical];
    const dashed=`${canonical.slice(0,8)}-${canonical.slice(8,12)}-${canonical.slice(12,16)}-${canonical.slice(16,20)}-${canonical.slice(20)}`;
    return [id,canonical,canonical.toUpperCase(),dashed,dashed.toUpperCase()];
  }))];
  if(scopedIds.length===0)return map;
  const idBatches=Array.from({length:Math.ceil(scopedIds.length/80)},(_,index)=>scopedIds.slice(index*80,(index+1)*80));
  for(const ids of idBatches){
    const where=` WHERE r.source_page_id IN (${ids.map(()=>"?").join(",")})`;
    const rows=(await db.prepare(`SELECT r.source_page_id,r.target_page_id,r.property_name,r.target_source_key,COALESCE(d.title,(SELECT fallback.title FROM notion_documents fallback WHERE LOWER(REPLACE(fallback.page_id,'-',''))=LOWER(REPLACE(r.target_page_id,'-','')) ORDER BY fallback.rowid DESC LIMIT 1)) AS title,COALESCE(d.notion_url,(SELECT fallback.notion_url FROM notion_documents fallback WHERE LOWER(REPLACE(fallback.page_id,'-',''))=LOWER(REPLACE(r.target_page_id,'-','')) ORDER BY fallback.rowid DESC LIMIT 1)) AS notion_url FROM notion_relations r LEFT JOIN notion_documents d ON d.page_id=r.target_page_id${where} ORDER BY r.property_name`).bind(...ids).all<{source_page_id:string;target_page_id:string;property_name:string;target_source_key:string|null;title:string|null;notion_url:string|null}>()).results??[];
    addRows(rows);
  }
  return map;
}

async function contentRowsByPageIds(db:D1Database,pageIds:string[]):Promise<StoredContentDocument[]> {
  const ids=[...new Set(pageIds)];
  const batches=Array.from({length:Math.ceil(ids.length/80)},(_,index)=>ids.slice(index*80,(index+1)*80));
  const rows:StoredContentDocument[]=[];
  for(const batch of batches){
    if(!batch.length)continue;
    rows.push(...((await db.prepare(`SELECT page_id,title,source_key,notion_url,last_edited_time,plain_text,properties_json,blocks_json FROM notion_documents WHERE page_id IN (${batch.map(()=>"?").join(",")}) AND source_key IN ('analyses','earnings','decisions','portfolio')`).bind(...batch).all<StoredContentDocument>()).results??[]));
  }
  const byId=new Map(rows.map(row=>[normalizeNotionPageId(row.page_id),row]));
  return ids.map(id=>byId.get(normalizeNotionPageId(id))).filter((row):row is StoredContentDocument=>Boolean(row));
}
function displayProperty(properties:JsonRecord, names:string[]):string|null { for(const name of names){const value=propertyValue(properties,name); if(value===null||value===undefined||value==="")continue; if(Array.isArray(value))return value.join(", "); return String(value);} return null; }
function decisionFields(properties:JsonRecord):DecisionFields|null {
  const fields:DecisionFields={
    action:displayProperty(properties,["Action","Decision"]),
    outcome:displayProperty(properties,["Outcome"]),
    account:displayProperty(properties,["Account"]),
    instrumentType:displayProperty(properties,["Instrument Type"]),
    currentWeight:displayProperty(properties,["Current Weight"]),
    maximumWeight:displayProperty(properties,["Maximum Weight"]),
    maximumEntryPrice:displayProperty(properties,["Maximum Entry Price"]),
    nextReview:displayProperty(properties,["Next Review","Next Review Date"]),
    confidence:displayProperty(properties,["Confidence"]),
    coreThesis:displayProperty(properties,["Core Thesis"]),
    entryCondition:displayProperty(properties,["Entry Condition"]),
    executionPlan:displayProperty(properties,["Execution Plan"]),
    fundingSource:displayProperty(properties,["Funding Source"]),
    catalyst:displayProperty(properties,["Catalyst","Catalysts"]),
    invalidationCriteria:displayProperty(properties,["Invalidation Criteria"]),
    keyRisk:displayProperty(properties,["Key Risk"]),
    reviewTrigger:displayProperty(properties,["Review Trigger"]),
  };
  return Object.values(fields).some(Boolean)?fields:null;
}
function earningsRefreshStatus(value:string|null):EarningsRefreshStatus {
  const normalized=normalizedPropertyName(value??"");
  if(!normalized)return "unknown";
  if(["not needed","no refresh needed","none","up to date"].includes(normalized))return "not-needed";
  if(["monitor","watch"].includes(normalized))return "monitor";
  if(["recommended","refresh recommended"].includes(normalized))return "recommended";
  if(["required","refresh required"].includes(normalized))return "required";
  return "unknown";
}
export function earningsReviewFields(properties:JsonRecord):EarningsReviewFields {
  const definitions:EarningsRefreshItem[]=[
    {key:"business",label:"Business",status:"unknown",rawValue:null},
    {key:"valuation",label:"Valorisation",status:"unknown",rawValue:null},
    {key:"short",label:"Short",status:"unknown",rawValue:null},
    {key:"portfolio",label:"Portfolio",status:"unknown",rawValue:null},
    {key:"memo",label:"Mémo CIO",status:"unknown",rawValue:null},
  ];
  const refreshes=definitions.map(item=>{
    const rawValue=displayProperty(properties,[`${item.key === "memo" ? "Memo" : item.key[0].toUpperCase()+item.key.slice(1)} Refresh`]);
    return {...item,rawValue,status:earningsRefreshStatus(rawValue)};
  });
  return {
    fiscalPeriod:displayProperty(properties,["Fiscal Period"]),
    guidance:displayProperty(properties,["Guidance Summary","Guidance"]),
    guidanceVsConsensus:displayProperty(properties,["Guidance vs Consensus"]),
    confidence:displayProperty(properties,["Confidence"]),
    refreshes,
  };
}
function notionBlocks(row:StoredContentDocument):unknown[]|undefined { if(!row.blocks_json)return undefined; try { const value=JSON.parse(row.blocks_json); return Array.isArray(value)?humanReadableNotionBlocks(value):undefined; } catch { return undefined; } }
/** Header fields and transport identity are not additional report paragraphs.
 * Keep unmapped source properties in the fallback so historical data is preserved. */
function reportPlainText(row:StoredContentDocument,properties:JsonRecord,fallback:string):string {
  if(!notionBlocks(row)?.length)return fallback;
  const metadata=new Set(["run id","agent","status","analysis date","date","decision date","earnings date","verdict","business verdict","confidence","confiance","score","business score","handoff summary","tl;dr","tldr","tl,dr","executive summary","summary"]);
  if(row.source_key==="earnings")for(const name of ["fiscal period","guidance","guidance summary","guidance vs consensus","business refresh","valuation refresh","short refresh","portfolio refresh","memo refresh"])metadata.add(name);
  const reportProperties=Object.fromEntries(Object.entries(properties).filter(([name])=>propertyEntry(properties,name).type!=="title"&&!metadata.has(name.trim().toLowerCase())&&!(name.trim().toLowerCase()==="source freshness"&&String(propertyValue(properties,name)).toLowerCase()==="unknown")));
  // Body text is already represented by the structured blocks. Reinjecting its
  // lossy flattened copy can replace tables/headings with fallback paragraphs.
  return snapshotPlainText(row.title,JSON.stringify(reportProperties),"[]","");
}
async function presentationForRow(row:StoredContentDocument):Promise<{ projection:AnalysisPresentationProjection|null; status:ProjectionStatus; error:string|null }> {
  if (!row.blocks_json) return { projection:null, status:"absent", error:null };
  try {
    const blocks:unknown=JSON.parse(row.blocks_json);
    const result=await verifyPresentationProjection(blocks);
    return { projection:result.status==="valid"?result.projection:null, status:result.status, error:result.error };
  } catch { return { projection:null, status:"invalid", error:"Le snapshot Notion ne peut pas être validé." }; }
}
async function documentFromRow(row:StoredContentDocument,relations:RelationLink[]=[],currentIds:Set<string>=new Set(),policy:ArchivePolicy|null=null,includePresentation=false):Promise<CompanyDocument> { const p=props(row); const displayText=row.blocks_json ? snapshotPlainText(row.title,row.properties_json,row.blocks_json,row.plain_text) : row.plain_text; const category=classifyDocument(row.source_key,row.title,displayText,p); const decision=row.source_key==="decisions"?decisionFields(p):null; const earningsReview=row.source_key==="earnings"?earningsReviewFields(p):null; const status=String(propertyValue(p,"Status")??""); const rowId=normalizeNotionPageId(row.page_id); const archived=policy?.archivedIds.has(rowId)??explicitlyArchived(row); const presentation=includePresentation?await presentationForRow(row):null; const document:CompanyDocument = {id:row.page_id,title:row.title,sourceKey:row.source_key,category,agent:agentFor(category,row.source_key),notionUrl:row.notion_url,lastEditedTime:row.last_edited_time,plainText:reportPlainText(row,p,displayText),notionBlocks:notionBlocks(row),...(presentation?{presentationProjection:presentation.projection,presentationStatus:presentation.status,presentationError:presentation.error}:{}),summary:displayProperty(p,["TL;DR","TLDR","TL,DR","Executive Summary","Summary","Guidance Summary"]),handoffSummary:displayProperty(p,["Handoff Summary"]),status,score:String(propertyValue(p,"Score")??propertyValue(p,"Business Score")??""),verdict:String(propertyValue(p,"Verdict")??propertyValue(p,"Business Verdict")??(decision?.action??"")),confidence:displayProperty(p,["Confidence","Confiance"]),date:(propertyValue(p,"Earnings Date")??propertyValue(p,"Date")??propertyValue(p,"Analysis Date")??propertyValue(p,"Decision Date")??null) as string|null,relations,archived,current:currentIds.has(rowId),decision,earningsReview}; if(includePresentation){try{document.normalizedAnalysis=normalizeAnalysisDocument({...document,archived:explicitlyArchived(row)});}catch(cause){const error=Object.assign(new Error("Analyse canonique invalide."),{code:"normalization",stage:"normalization"});(error as Error & {cause?:unknown}).cause=cause;throw error;} document.plainText="";document.notionBlocks=undefined;document.presentationProjection=undefined;} return document; }
function relatesToCompany(row:StoredContentDocument,company:CompanyListItem,links?:Map<string,string[]>):boolean { const p=props(row); const rowId=normalizeNotionPageId(row.page_id); const companyId=normalizeNotionPageId(company.id); if((links?.get(rowId)??[]).includes(companyId))return true; if(allRelationIds(p).includes(companyId))return true; const title=normalizedName(row.title); const name=normalizedName(company.name); const base=name.split(" ").filter(token=>!new Set(["group","holdings","holding","inc","corp","corporation","company","co","ltd","limited","plc","sa","class","a","adr"]).has(token)).join(" "); return Boolean(base && (title===name || title.startsWith(`${name} `) || title===base || title.startsWith(`${base} `))); }
type CurrentDocumentCategory = CompanySectionKey | "earnings";
type CurrentCompanyDocumentLinks = Map<string,Map<CurrentDocumentCategory,Set<string>>>;
const currentReferenceCategories:Record<ResearchReferenceKind,CurrentDocumentCategory>={business:"business",valuation:"valuation",short:"risques",portfolio:"portfolio",memo:"synthese"};
const currentEarningsProperties=["Current Earnings Analysis","Latest Earnings"];
const currentDecisionProperties=["Current Decision","Current Investment Decision","Latest Decision"];

/**
 * Canonical ownership comes from the Companies row itself.  These are the
 * relation properties named `Current …` in Notion, not mentions or reverse
 * relations found on an analysis page.  Keeping this map separate lets the
 * many-to-many index remain useful for search while company fiches stay
 * scoped to their own current documents.
 */
export function currentCompanyDocumentLinks(companyRows:StoredDocument[]):CurrentCompanyDocumentLinks {
  const result:CurrentCompanyDocumentLinks=new Map();
  for(const row of companyRows){
    const byCategory=new Map<CurrentDocumentCategory,Set<string>>();
    for(const [kind,property] of Object.entries(referenceProperties) as [ResearchReferenceKind,string][]){
      const ids=relationIds(props(row),[property]);
      if(ids.length)byCategory.set(currentReferenceCategories[kind],new Set(ids.map(normalizeNotionPageId)));
    }
    const earningsIds=relationIds(props(row),currentEarningsProperties);
    if(earningsIds.length)byCategory.set("earnings",new Set(earningsIds.map(normalizeNotionPageId)));
    const decisionIds=relationIds(props(row),currentDecisionProperties);
    if(decisionIds.length)byCategory.set("synthese",new Set([...(byCategory.get("synthese")??[]),...decisionIds.map(normalizeNotionPageId)]));
    result.set(normalizeNotionPageId(row.page_id),byCategory);
  }
  return result;
}
function explicitCurrentIdsFor(properties:JsonRecord,family:CurrentAnalysisFamily):string[]{
  const names:Record<CurrentAnalysisFamily,string[]>={
    business:["Current Business Analysis"], valuation:["Current Valuation Analysis"], short:["Current Short Analysis"],
    portfolio:["Current Portfolio Analysis"], cio_memo:["Current Investment Memo"], decision:currentDecisionProperties, earnings:currentEarningsProperties,
  };
  return relationIds(properties,names[family]);
}
function currentFamilyFor(row:StoredContentDocument,plainText:string,properties:JsonRecord):AnalysisFamily|null{
  const category=classifyDocument(row.source_key,row.title,plainText,properties);
  if(row.source_key==="decisions")return "decision";
  if(category==="earnings")return "earnings";
  if(category==="business")return "business";
  if(category==="valuation")return "valuation";
  if(category==="risques")return "short";
  if(category==="portfolio")return "portfolio";
  if(category==="synthese"&&String(propertyValue(properties,"Agent")??"").trim().toLowerCase().includes("memo"))return "cio_memo";
  if(category==="analyses")return "unknown";
  return null;
}
function safeReadError(code:"invalid_input"|"not_found",message:string):Error{return Object.assign(new Error(message),{code});}
/** Builds normalized Current-selection input from lightweight D1 headers; it does not choose or mutate a Current analysis. */
export async function readCurrentAnalysisContext(db:D1Database,companyId:string,family:CurrentAnalysisFamily):Promise<CurrentSelectionInput>{
  const canonicalCompanyId=normalizeNotionPageId(companyId);
  if(!canonicalCompanyId||!family)throw safeReadError("invalid_input","Les paramètres de sélection sont invalides.");
  const companyRows=(await db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='companies' ORDER BY title COLLATE NOCASE").all<StoredDocument>()).results??[];
  const companyRow=companyRows.find(row=>normalizeNotionPageId(row.page_id)===canonicalCompanyId);
  if(!companyRow)throw safeReadError("not_found","L'entreprise demandée est introuvable.");
  const companyProperties=props(companyRow);
  const explicitCurrentIds=explicitCurrentIdsFor(companyProperties,family);
  const primaryLinks=await documentPrimaryCompanyLinks(db);
  const listSql="SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,500) AS plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio') ORDER BY last_edited_time DESC";
  const headerRows=(await db.prepare(listSql).all<StoredContentDocument>()).results??[];
  const explicitRows:StoredContentDocument[]=[];
  for(let index=0;index<explicitCurrentIds.length;index+=80){
    const ids=explicitCurrentIds.slice(index,index+80);
    const rows=(await db.prepare(`SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,500) AS plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio') AND LOWER(REPLACE(page_id,'-','')) IN (${ids.map(()=>"?").join(",")})`).bind(...ids).all<StoredContentDocument>()).results??[];
    explicitRows.push(...rows);
  }
  const rowsById=new Map<string,StoredContentDocument>();
  for(const row of [...headerRows,...explicitRows])rowsById.set(normalizeNotionPageId(row.page_id),row);
  const candidates=[...rowsById.values()].flatMap(row=>{
    const properties=props(row);
    const rowPlainText=row.plain_text??"";
    const candidateFamily=currentFamilyFor(row,rowPlainText,properties);
    if(!candidateFamily)return [];
    const id=normalizeNotionPageId(row.page_id);
    const companyIds=documentCompanyIds(row,companyRows,primaryLinks);
    const dates=["Analysis Date","Date","Decision Date","Earnings Date"].flatMap(name=>{const value=propertyValue(properties,name);return value===null||value===undefined||value===""?[]:[String(value)];});
    const primaryDate=["Earnings Date","Date","Analysis Date","Decision Date"].map(name=>propertyValue(properties,name)).find(value=>value!==null&&value!==undefined&&value!=="");
    const status=String(propertyValue(properties,"Status")??"");
    const sourceFreshness:CurrentSelectionInput["candidates"][number]["sourceFreshness"]=String(propertyValue(properties,"Source Freshness")??"").trim().toLowerCase()==="current"?"fresh":"unknown";
    return [{id,family:candidateFamily,sourceKind:row.source_key==="decisions"?"decision" as const:"analysis" as const,agent:propertyValue(properties,"Agent")===null?null:String(propertyValue(properties,"Agent")),status,date:primaryDate===undefined?null:primaryDate===null?null:String(primaryDate),lastEditedTime:row.last_edited_time,companyIds,sourceFreshness,archived:explicitlyArchived(row),relatedDates:dates}];
  });
  return {companyId:canonicalCompanyId,family,explicitCurrentIds,candidates};
}
function currentDocumentIds(companyRows:StoredDocument[]):Set<string>{const ids=new Set<string>();for(const byCategory of currentCompanyDocumentLinks(companyRows).values())for(const categoryIds of byCategory.values())for(const id of categoryIds)ids.add(normalizeNotionPageId(id));return ids;}
function canonicalOwners(links:CurrentCompanyDocumentLinks):Map<string,string[]>{const result=new Map<string,string[]>();for(const [companyId,byCategory] of links)for(const ids of byCategory.values())for(const id of ids){const key=normalizeNotionPageId(id);const owners=result.get(key)??[];if(!owners.includes(companyId))owners.push(companyId);result.set(key,owners);}return result;}
function canonicalIdsForCategory(links:CurrentCompanyDocumentLinks,companyId:string,category:CurrentDocumentCategory):Set<string>{return links.get(normalizeNotionPageId(companyId))?.get(category)??new Set<string>();}
function primaryCompanyDocument(row:StoredContentDocument,company:CompanyListItem,companyRow:StoredDocument,primaryLinks:Map<string,string[]>):boolean { const companyRelationIds=allRelationIds(props(companyRow)); return companyRelationIds.includes(normalizeNotionPageId(row.page_id))||relatesToCompany(row,company,primaryLinks); }
function documentCompanyLabel(row:StoredContentDocument,companies:CompanyListItem[],owners:Map<string,string[]>,primaryLinks:Map<string,string[]>):string { const canonical=owners.get(normalizeNotionPageId(row.page_id)); if(canonical?.length){const names=canonical.map(id=>companies.find(company=>normalizeNotionPageId(company.id)===id)?.name).filter(Boolean) as string[];if(names.length)return names.join(", ");} const company=companies.find(item=>relatesToCompany(row,item,primaryLinks)); return company?.name??"Non relié"; }
export async function getCompanyDetail(db:D1Database,companyId:string):Promise<CompanyDetail|null>{
  const canonicalCompanyId=normalizeNotionPageId(companyId);
  const [companyRows, primaryLinks, rows] = await Promise.all([
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='companies' ORDER BY title COLLATE NOCASE").all<StoredDocument>().then(result => result.results ?? []),
    documentPrimaryCompanyLinks(db),
    db.prepare("SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,500) AS plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio') ORDER BY last_edited_time DESC").all<StoredContentDocument>().then(result => result.results ?? []),
  ]);
  const companyRow=companyRows.find(row=>normalizeNotionPageId(row.page_id)===canonicalCompanyId);
  if(!companyRow)return null;
  const canonical=currentCompanyDocumentLinks(companyRows);
  const currentIds=currentDocumentIds(companyRows);
  const policy=buildArchivePolicy(rows,companyRows,primaryLinks,currentIds);
  const [company]=await listCompanies(db,true,{companyRows,primaryLinks,analysisRows:rows,companyId:canonicalCompanyId,archivePolicy:policy});
  if(!company)return null;

  // Keep every document owned by this company in the candidate set.  A
  // populated Current relation selects the main version, but it must not hide
  // the older, explicitly related versions from the archive list.
  const candidateRows=rows.filter(row=>{
    const category=classifyDocument(row.source_key,row.title,row.plain_text,props(row));
    const id=normalizeNotionPageId(row.page_id);
    const current=canonicalIdsForCategory(canonical,canonicalCompanyId,category);
    return current.has(id)||primaryCompanyDocument(row,company,companyRow,primaryLinks);
  });
  const fullCandidateRows=await contentRowsByPageIds(db,candidateRows.map(row=>row.page_id));
  const candidateById=new Map(fullCandidateRows.map(row=>[normalizeNotionPageId(row.page_id),row]));
  const scopedRelations=await relationMap(db,candidateRows.map(row=>row.page_id));
  const candidates=await Promise.all(candidateRows.map(async header=>{
    const row=candidateById.get(normalizeNotionPageId(header.page_id));
    if(!row)return null;
    const id=normalizeNotionPageId(row.page_id);
    const doc=await documentFromRow(row,scopedRelations.get(id)??[],currentIds,policy,true);
    return {...doc,archived:policy.archivedIds.has(id),current:false};
  }));

  // A CIO memo and an investment-decision row are both synthesis documents,
  // but they are independent current records and must remain accessible at
  // the same time. Other categories keep their existing one-current rule.
  const byCategory=new Map<string,CompanyDocument[]>();
  for(const doc of candidates){
    if(!doc)continue;
    const categoryKey=doc.category==="synthese"?`${doc.category}:${doc.sourceKey}`:doc.category;
    const list=byCategory.get(categoryKey)??[];
    list.push(doc);
    byCategory.set(categoryKey,list);
  }
  const main:CompanyDocument[]=[];
  const archives:CompanyDocument[]=[];
  for(const items of byCategory.values()){
    const activeItems=items.filter(doc=>!doc.archived);
    const ranked=[...(activeItems.length?activeItems:items)].sort((a,b)=>{
      const freshnessDelta=(b.status.toLowerCase()==="validated"?1:0)-(a.status.toLowerCase()==="validated"?1:0);
      if(freshnessDelta!==0)return freshnessDelta;
      const delta=new Date(b.date||b.lastEditedTime).getTime()-new Date(a.date||a.lastEditedTime).getTime();
      if(Number.isFinite(delta)&&delta!==0)return delta;
      return normalizeNotionPageId(b.id).localeCompare(normalizeNotionPageId(a.id));
    });
    const latest=ranked[0];
    if(!latest)continue;
    main.push({...latest,archived:false,current:true});
    for(const item of items){
      if(normalizeNotionPageId(item.id)!==normalizeNotionPageId(latest.id)) archives.push({...item,archived:true,current:false});
    }
  }
  const sortDocs=(docs:CompanyDocument[])=>docs.sort((a,b)=>new Date(b.lastEditedTime).getTime()-new Date(a.lastEditedTime).getTime());
  sortDocs(main); sortDocs(archives);
  return {...company,analyses:main.filter(doc=>doc.sourceKey==="analyses"),earnings:main.filter(doc=>doc.sourceKey==="earnings"),decisions:main.filter(doc=>doc.sourceKey==="decisions"),portfolioDocuments:main.filter(doc=>doc.sourceKey==="portfolio"),archives};
}
export async function listResearchDocuments(db:D1Database,includePresentation=false):Promise<ResearchDocument[]>{
  const [primaryLinks, relations, companyResult, documentResult] = await Promise.all([
    documentPrimaryCompanyLinks(db),
    relationMap(db),
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='companies'").all<StoredDocument>(),
    db.prepare(includePresentation?"SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,700) AS plain_text,properties_json,blocks_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio') ORDER BY last_edited_time DESC":"SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,700) AS plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio') ORDER BY last_edited_time DESC").all<StoredContentDocument>(),
  ]);
  const companies=await listCompanies(db,false,{primaryLinks});
  const companyRows=companyResult.results??[];
  const canonical=currentCompanyDocumentLinks(companyRows);
  const owners=canonicalOwners(canonical);
  const currentIds=currentDocumentIds(companyRows);
  const rows=documentResult.results??[];
 const policy=buildArchivePolicy(rows,companyRows,primaryLinks,currentIds); return Promise.all(rows.map(async row=>{const doc=await documentFromRow(row,relations.get(row.page_id)??[],currentIds,policy,includePresentation);return {...doc,companyName:documentCompanyLabel(row,companies,owners,primaryLinks)};})); }

export async function getResearchDocument(db:D1Database,pageId:string):Promise<ResearchDocument|null>{
  const canonicalPageId=normalizeNotionPageId(pageId);
  const selectedColumns="page_id,title,source_key,notion_url,last_edited_time,plain_text,properties_json,blocks_json";
  const row=await db.prepare(`SELECT ${selectedColumns} FROM notion_documents WHERE page_id=? AND source_key IN ('analyses','earnings','decisions','portfolio') LIMIT 1`).bind(pageId).first<StoredContentDocument>()
    ??await db.prepare(`SELECT ${selectedColumns} FROM notion_documents WHERE LOWER(REPLACE(page_id, '-', ''))=? AND source_key IN ('analyses','earnings','decisions','portfolio') LIMIT 1`).bind(canonicalPageId).first<StoredContentDocument>();
  if(!row)return null;
  const [companyRows, primaryLinks, relations, allRows] = await Promise.all([
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='companies'").all<StoredDocument>().then(result => result.results ?? []),
    documentPrimaryCompanyLinks(db), relationMap(db,[row.page_id]),
    db.prepare("SELECT page_id,title,source_key,notion_url,last_edited_time,SUBSTR(plain_text,1,500) AS plain_text,properties_json FROM notion_documents WHERE source_key IN ('analyses','earnings','decisions','portfolio')").all<StoredContentDocument>().then(result => result.results ?? []),
  ]);
  const companies=await listCompanies(db,false,{primaryLinks});
  const owners=canonicalOwners(currentCompanyDocumentLinks(companyRows));const currentIds=currentDocumentIds(companyRows);const policy=buildArchivePolicy(allRows,companyRows,primaryLinks,currentIds);const doc=await documentFromRow(row,relations.get(normalizeNotionPageId(row.page_id))??[],currentIds,policy,true);return {...doc,companyName:documentCompanyLabel(row,companies,owners,primaryLinks)};
}
export type PortfolioSlice = { marketValueEur:number; investedValueEur:number; cashValueEur:number; costBasisEur:number; pnlEur:number; pnlPercent:number|null; brokerCostBasisEur:number; brokerPnlEur:number; brokerPnlPercent:number|null; positions:number };
export type ReconciliationIssue = { positionId:string|null; positionName:string|null; severity:"warning"|"error"; code:string; message:string };
export type LiveTargetLine = { id:string; name:string; target10kWeight:number; target10kEur:number; target25kWeight:number; target25kEur:number };
export type LivePortfolio = { refreshPending?:boolean; generatedAt:string; quoteAsOf:string|null; oldestQuoteAsOf:string|null; targetSource:"Notion Portfolio · Target Weight 10k + Target Weight"; targetLines:LiveTargetLine[]; targetTotals:{target10kWeight:number;target25kWeight:number}; totals:PortfolioSlice; slices:Record<string,PortfolioSlice>; positions:LivePosition[]; sectors:{name:string;valueEur:number;weight:number}[]; coverage:{live:number;manual:number;stale:number;unavailable:number;cash:number;total:number}; reconciliation:{status:"ok"|"warning"|"error";coherent:number;warnings:number;errors:number;issues:ReconciliationIssue[];accountChecks:Record<string,{linesValueEur:number;sliceValueEur:number;deltaEur:number}>}; calculation:{pnlScope:"unrealized-open-positions";realizedPnlAvailable:false;feesIncluded:false;dividendsIncluded:false;source:"Notion PRU + live quotes + FX"} };

function liveTargetLines(rows:StoredDocument[]):LiveTargetLine[] {
  const grouped = new Map<string,{name:string;target10kWeight:number;target25kWeight:number}>();
  for (const row of rows) {
    const p = props(row);
    const target10kWeight = (numeric(propertyValue(p,"Target Weight 10k")) ?? 0)*100;
    const target25kWeight = (numeric(propertyValue(p,"Target Weight")) ?? 0)*100;
    if(target10kWeight<=0&&target25kWeight<=0)continue;
    const name = cleanPositionName(String(propertyValue(p,"Position") ?? row.title));
    const quoteId = quoteByPosition[name];
    const id = targetAliases[name] ?? quoteId ?? normalizedName(name).replace(/ /g,"-");
    const current = grouped.get(id) ?? {name:targetLabels[id]??name,target10kWeight:0,target25kWeight:0};
    current.target10kWeight+=target10kWeight;
    current.target25kWeight+=target25kWeight;
    grouped.set(id,current);
  }
  return [...grouped.entries()]
    .map(([id,line])=>({id,name:line.name,target10kWeight:Number(line.target10kWeight.toFixed(4)),target10kEur:line.target10kWeight*100,target25kWeight:Number(line.target25kWeight.toFixed(4)),target25kEur:line.target25kWeight*250}))
    .sort((a,b)=>Math.max(b.target10kWeight,b.target25kWeight)-Math.max(a.target10kWeight,a.target25kWeight));
}

function mapPortfolioPosition(row:StoredDocument, companies:CompanyListItem[], companyLinks:Map<string,string[]>, quotes:Map<string,QuoteView>, normalizedEtfExposures:Map<string,Map<"country"|"sector"|"theme",LivePositionExposure[]>>):LivePosition {
  const p=props(row);
    const name = cleanPositionName(String(propertyValue(p,"Position") ?? row.title));
    const instrumentType = String(propertyValue(p,"Instrument Type") ?? "");
    const account = String(propertyValue(p,"Account") ?? "");
    const quantity = numeric(propertyValue(p,"Quantity")) ?? 0;
    const pruEur = numeric(propertyValue(p,"PRU"));
    const explicitBrokerPru = numeric(propertyValue(p,"Broker PRU"));
    const brokerPruEur = explicitBrokerPru ?? pruEur;
    const pruSource:LivePosition["pruSource"] = explicitBrokerPru != null ? "notion-broker-pru" : pruEur != null ? "notion-pru" : "missing";
    const manualPrice = numeric(propertyValue(p,"Current Price"));
    const priceCurrency = String(propertyValue(p,"Price Currency") ?? "").toUpperCase();
    const manualFxToEur = numeric(propertyValue(p,"FX to EUR"));
    const quoteId = quoteByPosition[name];
    const targetId = targetAliases[name] ?? quoteId ?? normalizedName(name).replace(/ /g,"-");
    const quote: QuoteView|undefined = quoteId ? quotes.get(quoteId) : undefined;
    const isCash = isCashName(name,instrumentType);
    const manualPriceEur = manualPrice == null ? null : priceCurrency === "EUR" || !priceCurrency ? manualPrice : manualFxToEur == null ? null : manualPrice * manualFxToEur;
    const usesManualPrice = !isCash && quote?.eurPrice == null && manualPriceEur != null;
    const eurPrice = isCash ? 1 : quote?.eurPrice ?? manualPriceEur;
    const marketValueEur = eurPrice == null ? null : quantity * eurPrice;
    const costBasisEur = isCash ? quantity : pruEur == null ? 0 : quantity * pruEur;
    const brokerCostBasisEur = isCash ? quantity : brokerPruEur == null ? 0 : quantity * brokerPruEur;
    const pnlEur = marketValueEur == null ? null : marketValueEur - costBasisEur;
    const brokerPnlEur = marketValueEur == null ? null : marketValueEur - brokerCostBasisEur;
    const notionTargetWeight = numeric(propertyValue(p,"Target Weight"));
    const notionTarget10kWeight = numeric(propertyValue(p,"Target Weight 10k"));
    const targetWeight = notionTargetWeight == null ? 0 : notionTargetWeight * 100;
    const target10kWeight = notionTarget10kWeight == null ? 0 : notionTarget10kWeight * 100;
    const relatedIds = relationIds(p,["Company","Companies","Company relation","Company Relation"]);
    const fallbackCompany = companies.find(company => { const position=normalizedName(name); const candidate=normalizedName(company.name); return candidate && (position===candidate || position.startsWith(`${candidate} `) || candidate.startsWith(`${position} `)); });
    const indexedCompanyIds = companyLinks.get(row.page_id) ?? [];
    const companyIds = [...new Set([...indexedCompanyIds,...relatedIds,...(fallbackCompany ? [fallbackCompany.id] : [])])];
    const warning = quantity <= 0 ? "Quantité absente ou nulle" : !isCash && pruEur == null ? "PRU Notion manquant" : eurPrice == null ? priceCurrency && priceCurrency !== "EUR" && manualPrice != null && manualFxToEur == null ? `Cours manuel ${priceCurrency} sans taux EUR` : "Cours indisponible" : usesManualPrice ? "Cours manuel Notion" : null;
    const linkedCompany = companies.find(company => companyIds.map(normalizeNotionPageId).includes(normalizeNotionPageId(company.id)));
    const country=linkedCompany?.country?displayCountry(linkedCompany.country):null;
    const etfExposures=normalizedEtfExposures.get(normalizeNotionPageId(row.page_id));
    const countryExposures=etfExposures?.get("country")??[];
    const sectorExposures=etfExposures?.get("sector")??[];
    const themeExposures=etfExposures?.get("theme")??[];
    return { id:row.page_id, targetId, name, instrumentType, account, sector:String(propertyValue(p,"Sector") ?? linkedCompany?.sector ?? "Autres"), industry:linkedCompany?.industry ?? "", themes:linkedCompany?.themes ?? [], primaryTheme:String(propertyValue(p,"Primary Theme")??"").trim(), country, countryExposures, sectorExposures, themeExposures, quantity, pruEur, brokerPruEur, pruSource, costBasisEur, brokerCostBasisEur, marketValueEur, pnlEur, pnlPercent:pnlEur == null || costBasisEur === 0 ? null : pnlEur/costBasisEur*100, brokerPnlEur, brokerPnlPercent:brokerPnlEur == null || brokerCostBasisEur === 0 ? null : brokerPnlEur/brokerCostBasisEur*100, weight:null, targetWeight, targetEur:targetWeight/100*25000, target10kWeight, target10kEur:target10kWeight/100*10000, quoteSymbol:quoteId ?? null, nativePrice:isCash ? 1 : quote?.nativePrice ?? manualPrice, nativeCurrency:isCash ? "EUR" : (quote?.nativeCurrency ?? (priceCurrency || "EUR")), eurPrice, fxRate:isCash ? 1 : quote?.fxRate ?? (usesManualPrice ? manualFxToEur : null), fxMarketTime:isCash ? null : quote?.fxMarketTime ?? null, fetchedAt:quote?.fetchedAt ?? null, quoteWarnings:quote?.warnings ?? [], changePercent:quote?.changePercent ?? null, quoteSource:isCash ? "cash" : usesManualPrice ? "notion-manual" : quote?.source ?? "unavailable", quoteFreshness:isCash ? "fresh" : usesManualPrice ? "manual" : quote?.freshness ?? "unavailable", marketTime:quote?.marketTime ?? null, companyIds, notionUrl:row.notion_url, warning };
}

export async function getLivePortfolio(db: D1Database, force = false, cacheOnly = false): Promise<LivePortfolio> {
  const rows = (await db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='portfolio' ORDER BY title COLLATE NOCASE").all<StoredDocument>()).results ?? [];
  // Mirrors the Notion Portfolio → Active Positions view. We intentionally
  // keep inactive rows in the local archive so a sale/status change is
  // observable, but only exact Status=Active rows enter the live projection.
  const source = rows.map(row => ({row,p:props(row)})).filter(({p}) => String(propertyValue(p,"Status") ?? "").trim().toLowerCase() === "active" && (numeric(propertyValue(p,"Quantity")) ?? 0) > 0);
  // Targets are independent from live holdings: a Notion line may define a
  // future allocation without a current position. Explicitly closed/sold
  // rows stay out so historical holdings cannot re-enter the trajectory.
  const targetRows = rows.filter(row => {
    const properties = props(row);
    const hasTarget = (numeric(propertyValue(properties,"Target Weight 10k")) ?? 0) > 0 || (numeric(propertyValue(properties,"Target Weight")) ?? 0) > 0;
    return hasTarget && !isClosedPortfolioRow(properties);
  });
  const ids = [...new Set(source.map(({row,p}) => quoteByPosition[cleanPositionName(String(propertyValue(p,"Position") ?? row.title))]).filter(Boolean))];
  const [companies, companyLinks, quoteList, exposureRows] = await Promise.all([
    listCompanies(db,false,{portfolioRows:rows}), documentCompanyLinks(db), getQuotes(ids, force, db, cacheOnly),
    db.prepare("SELECT page_id,title,notion_url,properties_json FROM notion_documents WHERE source_key='etf_exposures'").all<StoredDocument>(),
  ]);
  const etfExposureRows=new Map<string,Map<"country"|"sector"|"theme",{name:string;weight:number;effectiveDate:string}[]>>();
  for(const row of exposureRows.results??[]){
    const p=props(row);
    if(String(propertyValue(p,"Data Status")??"").trim().toLowerCase()!=="current")continue;
    const weight=numeric(propertyValue(p,"Weight"));
    if(weight==null||weight<=0)continue;
    const rawType=String(propertyValue(p,"Exposure Type")??"").trim().toLowerCase();
    const type=rawType==="country"||rawType==="sector"||rawType==="theme"?rawType:null;
    if(!type)continue;
    const names=relationIds(p,["ETF Position"]);
    const name=type==="country"?displayCountry(String(propertyValue(p,"Country")??"")):String(propertyValue(p,"Exposure")??row.title).replace(/^.*?\s+[—–-]\s+/,"").trim();
    if(!name)continue;
    for(const positionId of names){
      const byType=etfExposureRows.get(positionId)??new Map();
      const current=byType.get(type)??[];
      current.push({name,weight,effectiveDate:String(propertyValue(p,"Effective Date")??"")});
      byType.set(type,current);
      etfExposureRows.set(positionId,byType);
    }
  }
  const normalizedEtfExposures=new Map<string,Map<"country"|"sector"|"theme",LivePositionExposure[]>>();
  for(const [positionId,byType] of etfExposureRows){
    const normalizedByType=new Map<"country"|"sector"|"theme",LivePositionExposure[]>();
    for(const [type,items] of byType){
      const latestDate=items.reduce((latest,item)=>item.effectiveDate>latest?item.effectiveDate:latest,"");
      const currentItems=latestDate?items.filter(item=>item.effectiveDate===latestDate):items;
      const total=currentItems.reduce((sum,item)=>sum+item.weight,0);
      if(total<0.95||total>1.05)continue;
      const grouped=new Map<string,number>();
      for(const item of currentItems)grouped.set(item.name,(grouped.get(item.name)??0)+item.weight/total);
      normalizedByType.set(type,[...grouped].map(([name,weight])=>({name,weight})));
    }
    normalizedEtfExposures.set(positionId,normalizedByType);
  }
  const quotes = new Map(quoteList.map(q => [q.assetId,q]));
  const preliminary = source.map(({row}) => mapPortfolioPosition(row,companies,companyLinks,quotes,normalizedEtfExposures));
  const { positions, sectors, slices, coverage } = calculatePortfolioAggregates(preliminary);
  const issues:ReconciliationIssue[]=[];
  for(const position of positions){
    if(position.quantity<=0)issues.push({positionId:position.id,positionName:position.name,severity:"error",code:"quantity_missing",message:"Quantité absente ou nulle dans Notion."});
    if(!isCashName(position.name,position.instrumentType)&&position.pruEur==null)issues.push({positionId:position.id,positionName:position.name,severity:"error",code:"pru_missing",message:"PRU Notion manquant : la PV ne peut pas être fiabilisée."});
    if(!position.account)issues.push({positionId:position.id,positionName:position.name,severity:"warning",code:"account_missing",message:"Enveloppe absente dans Notion."});
    if(position.marketValueEur==null)issues.push({positionId:position.id,positionName:position.name,severity:"error",code:"price_unavailable",message:"Cours EUR indisponible."});
    if(position.quoteFreshness==="stale")issues.push({positionId:position.id,positionName:position.name,severity:"warning",code:"quote_stale",message:"Dernier cours disponible obsolète."});
    if(position.quoteSource==="notion-manual")issues.push({positionId:position.id,positionName:position.name,severity:"warning",code:"manual_quote",message:"Cours manuel Notion utilisé."});
    if(position.nativeCurrency!=="EUR"&&position.fxRate==null)issues.push({positionId:position.id,positionName:position.name,severity:"error",code:"fx_missing",message:`Taux ${position.nativeCurrency}/EUR indisponible.`});
  }
  const accountChecks:LivePortfolio["reconciliation"]["accountChecks"]={};
  for(const key of ["total",...Object.keys(slices).filter(key=>key!=="total")]){
    const rowsForSlice=key==="total"?positions:positions.filter(position=>position.account===key);
    const linesValueEur=rowsForSlice.reduce((sum,position)=>sum+(position.marketValueEur??0),0);
    const sliceValueEur=(slices[key]??slices.total).marketValueEur;
    const deltaEur=linesValueEur-sliceValueEur;
    accountChecks[key]={linesValueEur,sliceValueEur,deltaEur};
    if(Math.abs(deltaEur)>0.01)issues.push({positionId:null,positionName:null,severity:"error",code:"aggregate_mismatch",message:`Le total ${key} diffère de la somme des lignes de ${deltaEur.toFixed(2)} €.`});
  }
  const errors=issues.filter(issue=>issue.severity==="error").length;
  const warnings=issues.filter(issue=>issue.severity==="warning").length;
  const quoteDates=quoteList.map(q=>q.marketTime).filter((value):value is string=>Boolean(value)).sort();
  const targetLines = liveTargetLines(targetRows);
  const targetTotals={target10kWeight:targetLines.reduce((sum,line)=>sum+line.target10kWeight,0),target25kWeight:targetLines.reduce((sum,line)=>sum+line.target25kWeight,0)};
  return {
    ...(cacheOnly?{refreshPending:quoteList.some(q=>q.warnings.some(w=>w.includes("cache_refresh_needed")))}:{}),
    generatedAt:new Date().toISOString(),quoteAsOf:quoteDates.at(-1)??null,oldestQuoteAsOf:quoteDates.at(0)??null,
    targetSource:"Notion Portfolio · Target Weight 10k + Target Weight",targetLines,targetTotals,
    totals:slices.total,slices,positions,sectors,
    coverage,
    reconciliation:{status:errors?"error":warnings?"warning":"ok",coherent:Math.max(0,positions.length-new Set(issues.map(issue=>issue.positionId).filter(Boolean)).size),warnings,errors,issues,accountChecks},
    calculation:{pnlScope:"unrealized-open-positions",realizedPnlAvailable:false,feesIncluded:false,dividendsIncluded:false,source:"Notion PRU + live quotes + FX"},
  };
}

/** Lifecycle is read from the persisted Portfolio row, never inferred from missing live holdings. */
export async function readPosition(db:D1Database,id:string,options:{force?:boolean;cacheOnly?:boolean}={}):Promise<import("../../core/contracts/investment").Position|null> {
  const rows=(await db.prepare("SELECT page_id,title,notion_url,properties_json,last_edited_time FROM notion_documents WHERE source_key='portfolio' AND LOWER(REPLACE(page_id,'-',''))=?").bind(normalizeNotionPageId(id)).all<StoredDocument & {last_edited_time:string}>()).results??[];
  if(!rows.length)return null;
  if(rows.length!==1)throw Object.assign(new Error("Position ambiguë."),{code:"mapping"});
  const row=rows[0], p=props(row);
  const status=String(propertyValue(p,"Status")??"").trim().toLowerCase();
  const quantity=numeric(propertyValue(p,"Quantity"));
  const fail=()=>{throw Object.assign(new Error("Statut ou quantité de position incohérent."),{code:"mapping"});};
  if(quantity===null||quantity<0)return fail();
  const provenance={kind:"notion" as const,sourceId:normalizeNotionPageId(row.page_id),revision:row.last_edited_time,capturedAt:row.last_edited_time};
  if(status==="active"){
    if(quantity<=0)return fail();
    const portfolio=await getLivePortfolio(db,options.force??false,options.cacheOnly??false);
    const position=portfolio.positions.find(item=>normalizeNotionPageId(item.id)===normalizeNotionPageId(id));
    if(!position)return fail();
    return {...position,id:normalizeNotionPageId(position.id),companyIds:position.companyIds.map(normalizeNotionPageId),schemaVersion:"1.0.0",lifecycle:"open",provenance};
  }
  if(!/^(sold|vendu|vendue|closed)$/.test(status))return fail();
  const [companies,links]=await Promise.all([listCompanies(db,false),documentPrimaryCompanyLinks(db)]);
  const position=mapPortfolioPosition(row,companies,links,new Map(),new Map());
  const closedAt=propertyValue(p,"Closed Date")??propertyValue(p,"Exit Date")??null;
  return {...position,id:normalizeNotionPageId(position.id),companyIds:position.companyIds.map(normalizeNotionPageId),schemaVersion:"1.0.0",lifecycle:"closed",closedAt:closedAt===null?null:String(closedAt),marketValueEur:null,pnlEur:null,pnlPercent:null,brokerPnlEur:null,brokerPnlPercent:null,weight:null,nativePrice:null,eurPrice:null,fxRate:null,quoteSource:"unavailable",quoteFreshness:"unavailable",provenance};
}
