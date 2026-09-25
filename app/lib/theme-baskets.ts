import type { CompanyListItem } from "./investment-data.ts";
import {
  fxSymbolForCurrency,
  getCachedCompanyHistories,
  getCompanyHistory,
  hasYearOfDailyHistory,
  historicalPriceInEur,
  yahooSymbolForTicker,
  type CachedHistory,
  type Currency,
} from "./quotes.ts";

export type BasketDimension="sector"|"theme";
export type BasketPeriod="1d"|"5d"|"1m"|"6m"|"YTD"|"1y"|"5y"|"max";
export const basketPeriods:BasketPeriod[]=["1d","5d","1m","6m","YTD","1y","5y","max"];
type CompanyPerformance={id:string;name:string;ticker:string;ownershipStatus:CompanyListItem["ownershipStatus"];sector:string;themes:string[];returnPercent:number|null};
export type BasketSummary={name:string;returnPercent:number|null;memberCount:number;coveredCount:number;ownedCount:number;startDate:string|null;endDate:string|null};
export type BasketDetail=BasketSummary&{series:{date:string;value:number}[];companies:CompanyPerformance[]};
export type ThemeBasketResponse={generatedAt:string;dimension:BasketDimension;period:BasketPeriod;baskets:(BasketSummary&{searchText:string})[];selectedBasket:BasketDetail|null;details:BasketDetail[];refreshErrors:string[];refreshNeeded?:boolean;companiesSyncedAt?:string|null;refreshProgress?:{nextBatch:number;totalBatches:number;complete:boolean;running?:boolean}};
export type BasketRefreshProgress={refreshProgress:{nextBatch:number;totalBatches:number;complete:boolean;running?:boolean}};

type CompanySeries={company:CompanyListItem;eurPrices:Map<string,number>};
const normalized=(value:string)=>value.trim().replace(/\s+/g," ");
const maxCarryForwardDays=5;

function withinDays(later:string,earlier:string,maximum=maxCarryForwardDays){
  return Date.parse(`${later}T00:00:00Z`)-Date.parse(`${earlier}T00:00:00Z`)<=maximum*86400000;
}

function membership(company:CompanyListItem,dimension:BasketDimension){
  if(dimension==="sector")return [normalized(company.sector)||"Autres"];
  const values=[...new Set(company.themes.map(normalized).filter(Boolean))];
  return values.length?values:["Non ventilé thématiquement"];
}

function periodStart(latest:string,period:BasketPeriod){
  const end=new Date(`${latest}T12:00:00Z`);
  if(period==="1d")return new Date(end.getTime()-2*86400000).toISOString().slice(0,10);
  if(period==="5d")return new Date(end.getTime()-9*86400000).toISOString().slice(0,10);
  if(period==="YTD")return `${end.getUTCFullYear()}-01-01`;
  const months=period==="1m"?1:period==="6m"?6:period==="1y"?12:period==="5y"?60:0;
  if(months){
    const monthIndex=end.getUTCFullYear()*12+end.getUTCMonth()-months;
    const year=Math.floor(monthIndex/12),month=monthIndex-year*12,day=end.getUTCDate();
    const lastDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    end.setUTCFullYear(year,month,Math.min(day,lastDay));
  }
  if(period==="max")return "0000-01-01";
  return end.toISOString().slice(0,10);
}

function pointAtOrBefore<T extends {date:string}>(points:T[],date:string){
  let low=0,high=points.length-1,result=-1;
  while(low<=high){const middle=(low+high)>>1;if(points[middle].date<=date){result=middle;low=middle+1;}else high=middle-1;}
  return result<0?null:points[result];
}

function companyPricesInEur(history:CachedHistory,fxHistory:CachedHistory|null){
  const prices=new Map<string,number>();
  for(const point of history.points){
    const fxPoint=history.currency==="EUR"?null:fxHistory?pointAtOrBefore(fxHistory.points,point.date):null;
    const fx=history.currency==="EUR"?1:fxPoint&&withinDays(point.date,fxPoint.date)?fxPoint.adjustedClose:null;
    if(fx==null)continue;
    const eur=historicalPriceInEur(point.adjustedClose,history.currency,fx);
    if(eur!=null)prices.set(point.date,eur);
  }
  return prices;
}

function basketFor(name:string,series:CompanySeries[],period:BasketPeriod):BasketDetail{
  const latest=series.map(item=>[...item.eurPrices.keys()].sort().at(-1)).filter((date):date is string=>Boolean(date)).sort().at(-1)??null;
  if(!latest)return {name,returnPercent:null,memberCount:series.length,coveredCount:0,ownedCount:series.filter(item=>item.company.ownershipStatus==="Owned").length,startDate:null,endDate:null,series:[],companies:series.map(({company})=>({...companySummary(company),returnPercent:null}))};

  const availableDates=[...new Set(series.flatMap(item=>[...item.eurPrices.keys()]))].sort();
  const requestedStart=periodStart(latest,period);
  const shortWindowStart=period==="1d"?availableDates.at(-2):period==="5d"?availableDates.at(-6):undefined;
  const commonMaxStart=period==="max"?availableDates[0]??requestedStart:requestedStart;
  const baseDate=period==="1d"||period==="5d"?shortWindowStart??requestedStart:commonMaxStart;
  const endDate=latest;
  const prepared=series.flatMap(item=>{
    const points=[...item.eurPrices.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,close:value,adjustedClose:value}));
    const base=pointAtOrBefore(points,baseDate);
    const end=pointAtOrBefore(points,endDate);
    if(!base||!end||base.date===end.date||!withinDays(baseDate,base.date)||!withinDays(endDate,end.date))return [];
    return [{item,points,baseDate:base.date,baseValue:base.adjustedClose,returnPercent:(end.adjustedClose/base.adjustedClose-1)*100}];
  });
  const dates=[baseDate,...new Set(prepared.flatMap(item=>item.points.filter(point=>point.date>=baseDate&&point.date<=endDate).map(point=>point.date)))].sort();
  const chart=dates.map(date=>{
    const values=prepared.flatMap(item=>{
      const price=pointAtOrBefore(item.points,date);
      return price?[(price.adjustedClose/item.baseValue)*100]:[];
    });
    return values.length?{date,value:values.reduce((sum,value)=>sum+value,0)/values.length}:null;
  }).filter((point):point is {date:string;value:number}=>point!==null);
  const latestValue=chart.at(-1)?.value;
  const returnsByCompany=new Map(prepared.map(({item,returnPercent})=>[item.company.id,returnPercent]));
  const companies=series.map(({company})=>({...companySummary(company),returnPercent:returnsByCompany.get(company.id)??null})).sort((a,b)=>(b.returnPercent??-Infinity)-(a.returnPercent??-Infinity));
  return {
    name,returnPercent:latestValue==null?null:latestValue-100,memberCount:series.length,coveredCount:prepared.length,
    ownedCount:series.filter(item=>item.company.ownershipStatus==="Owned").length,
    startDate:chart[0]?.date??null,endDate:chart.at(-1)?.date??null,series:chart,companies,
  };
}

function companySummary(company:CompanyListItem){
  return {id:company.id,name:company.name,ticker:company.ticker,ownershipStatus:company.ownershipStatus,sector:company.sector,themes:company.themes};
}

export function projectBasketSeries(series:{date:string;value:number}[],maximum=400){
  const limit=Math.max(4,Math.floor(maximum));
  if(series.length<=limit)return series;
  const indices=new Set<number>([0,series.length-1]);
  let minimum=0,maximumIndex=0;
  for(let index=1;index<series.length;index++){
    if(series[index].value<series[minimum].value)minimum=index;
    if(series[index].value>series[maximumIndex].value)maximumIndex=index;
  }
  indices.add(minimum);indices.add(maximumIndex);
  const sampleCount=Math.max(2,limit-4);
  for(let sample=0;sample<sampleCount;sample++)indices.add(Math.round(sample*(series.length-1)/(sampleCount-1)));
  return [...indices].sort((a,b)=>a-b).map(index=>series[index]);
}

function projectBasketResponse(response:ThemeBasketResponse):ThemeBasketResponse{
  const details=response.details.map(detail=>({...detail,series:projectBasketSeries(detail.series)}));
  const selectedBasket=details.find(detail=>detail.name===response.selectedBasket?.name)??details[0]??null;
  return {...response,details,selectedBasket};
}

export function buildThemeBaskets(companies:CompanyListItem[],histories:Map<string,CachedHistory>,fxHistories:Map<Currency,CachedHistory>,dimension:BasketDimension,period:BasketPeriod,selectedName?:string):Pick<ThemeBasketResponse,"baskets"|"selectedBasket"|"details">{
  const byName=new Map<string,CompanySeries[]>();
  for(const company of companies){
    const history=histories.get(company.id);
    const fxSymbol=history?fxSymbolForCurrency(history.currency):null;
    const fx=history&&fxSymbol?fxHistories.get(history.currency)??null:null;
    const eurPrices=history?companyPricesInEur(history,fx):new Map<string,number>();
    for(const name of membership(company,dimension)){
      const list=byName.get(name)??[];
      list.push({company,eurPrices});
      byName.set(name,list);
    }
  }
  const details=[...byName.entries()].map(([name,items])=>basketFor(name,items,period)).sort((a,b)=>(b.returnPercent??-Infinity)-(a.returnPercent??-Infinity));
  const baskets=details.map(item=>({name:item.name,returnPercent:item.returnPercent,memberCount:item.memberCount,coveredCount:item.coveredCount,ownedCount:item.ownedCount,startDate:item.startDate,endDate:item.endDate,searchText:item.companies.map(company=>`${company.name} ${company.ticker}`).join(" ")}));
  const selectedBasket=details.find(item=>item.name===selectedName)??(selectedName?null:details[0]??null);
  return {baskets,selectedBasket,details};
}

async function mapLimited<T,R>(items:T[],limit:number,run:(item:T,index:number)=>Promise<R>):Promise<R[]>{
  const results=new Array<R>(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const index=next++;if(index>=items.length)return;results[index]=await run(items[index],index);}}));
  return results;
}

const snapshotTableInitialization=new WeakMap<object,Promise<void>>();
async function ensureSnapshotTable(db:D1Database){
  const key=db as object,existing=snapshotTableInitialization.get(key);
  if(existing){await existing;return;}
  const ready=db.prepare("CREATE TABLE IF NOT EXISTS theme_basket_cache (cache_key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL)").run().then(()=>undefined);
  snapshotTableInitialization.set(key,ready);
  try{
    await ready;
    await db.prepare("CREATE TABLE IF NOT EXISTS theme_basket_refresh_state (cache_key TEXT PRIMARY KEY, next_batch INTEGER NOT NULL, total_batches INTEGER NOT NULL, force_refresh INTEGER NOT NULL, refresh_errors TEXT NOT NULL DEFAULT '[]', lease_until INTEGER, updated_at TEXT NOT NULL)").run();
    const columns=(await db.prepare("PRAGMA table_info(theme_basket_refresh_state)").all<{name:string}>()).results??[];
    if(!columns.some(column=>column.name==="refresh_errors"))await db.prepare("ALTER TABLE theme_basket_refresh_state ADD COLUMN refresh_errors TEXT NOT NULL DEFAULT '[]'").run();
  }catch(error){snapshotTableInitialization.delete(key);throw error;}
}
const cacheKey=(dimension:BasketDimension,period:BasketPeriod)=>`${dimension}:${period}`;
async function readBasketSnapshot(db:D1Database,dimension:BasketDimension,period:BasketPeriod){
  await ensureSnapshotTable(db);
  const row=await db.prepare("SELECT value_json FROM theme_basket_cache WHERE cache_key = ?").bind(cacheKey(dimension,period)).first<{value_json:string}>();
  if(!row)return null;
  try{return JSON.parse(row.value_json) as ThemeBasketResponse;}catch{return null;}
}
async function writeBasketSnapshot(db:D1Database,response:ThemeBasketResponse){
  await ensureSnapshotTable(db);
  const serialized=JSON.stringify(response);
  if(new TextEncoder().encode(serialized).byteLength>1_800_000)throw new Error("Snapshot du panier trop volumineux pour D1");
  await db.prepare("INSERT INTO theme_basket_cache (cache_key,value_json,updated_at) VALUES (?,?,?) ON CONFLICT(cache_key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at")
    .bind(cacheKey(response.dimension,response.period),serialized,response.generatedAt).run();
}
async function companiesSyncTimestamp(db:D1Database):Promise<string|null>{
  try{return (await db.prepare("SELECT last_completed_at FROM notion_sync_state WHERE source_key='companies'").first<{last_completed_at:string|null}>())?.last_completed_at??null;}catch{return null;}
}

async function readBasketDataset(db:D1Database){
  const {listCompanies}=await import("./investment-data.ts");
  const companiesSyncedAt=await companiesSyncTimestamp(db);
  const companies=await listCompanies(db,false);
  const supportedCurrencies:Currency[]=["USD","JPY","GBP","SEK","KRW","CHF"];
  const currencies=[...new Set(companies.filter(company=>company.ticker).map(company=>company.currency.toUpperCase()).filter((currency):currency is Currency=>supportedCurrencies.includes(currency as Currency)))];
  const fxSymbols=currencies.map(currency=>fxSymbolForCurrency(currency)).filter((symbol):symbol is string=>Boolean(symbol));
  const cachedBySymbol=await getCachedCompanyHistories([...companies.map(company=>company.ticker),...fxSymbols],db);
  const histories=new Map<string,CachedHistory>();
  companies.forEach(company=>{const history=company.ticker?cachedBySymbol.get(yahooSymbolForTicker(company.ticker)):null;if(history)histories.set(company.id,history);});
  const fxHistories=new Map<Currency,CachedHistory>();
  for(const currency of currencies){const symbol=fxSymbolForCurrency(currency);const history=symbol?cachedBySymbol.get(symbol):null;if(history)fxHistories.set(currency,history);}
  const quoteRefreshNeeded=companies.some(company=>{
    if(!company.ticker)return false;
    const history=histories.get(company.id);
    return !history||!hasYearOfDailyHistory(history)||Date.now()-Date.parse(history.fetchedAt)>45*60_000;
  });
  const fxRefreshNeeded=[...new Set(companies.filter(company=>company.ticker).map(company=>company.currency.toUpperCase()).filter((currency):currency is Currency=>supportedCurrencies.includes(currency as Currency)))].some(currency=>{
    const history=fxHistories.get(currency);return !history||!hasYearOfDailyHistory(history)||Date.now()-Date.parse(history.fetchedAt)>45*60_000;
  });
  const syncChangedDuringBuild=companiesSyncedAt!==await companiesSyncTimestamp(db);
  return {companies,histories,fxHistories,refreshNeeded:quoteRefreshNeeded||fxRefreshNeeded||syncChangedDuringBuild,companiesSyncedAt};
}

function buildFromDataset(dataset:Awaited<ReturnType<typeof readBasketDataset>>,options:{dimension:BasketDimension;period:BasketPeriod;selectedName?:string}):ThemeBasketResponse{
  const calculated=buildThemeBaskets(dataset.companies,dataset.histories,dataset.fxHistories,options.dimension,options.period,options.selectedName);
  return projectBasketResponse({generatedAt:new Date().toISOString(),dimension:options.dimension,period:options.period,...calculated,refreshErrors:[],refreshNeeded:dataset.refreshNeeded,companiesSyncedAt:dataset.companiesSyncedAt});
}

async function buildFromCache(db:D1Database,options:{dimension:BasketDimension;period:BasketPeriod;selectedName?:string}):Promise<ThemeBasketResponse>{
  return buildFromDataset(await readBasketDataset(db),options);
}

async function publishBasketSnapshots(db:D1Database,refreshErrors:string[]){
  const dataset=await readBasketDataset(db);
  const generatedAt=new Date().toISOString();
  const snapshots=(["theme","sector"] as BasketDimension[]).flatMap(dimension=>basketPeriods.map(period=>{
    const response=buildFromDataset(dataset,{dimension,period});
    response.generatedAt=generatedAt;
    response.refreshErrors=refreshErrors;
    return response;
  }));
  if(snapshots.some(response=>new TextEncoder().encode(JSON.stringify(response)).byteLength>1_800_000))throw new Error("Snapshot du panier trop volumineux pour D1");
  await Promise.all(snapshots.map(response=>writeBasketSnapshot(db,response)));
  return snapshots;
}

export async function getThemeBaskets(db:D1Database,options:{dimension:BasketDimension;period:BasketPeriod;selectedName?:string;refresh?:boolean;force?:boolean;batch?:number}) :Promise<ThemeBasketResponse|BasketRefreshProgress>{
  const saved=await readBasketSnapshot(db,options.dimension,options.period);
  const sourceStamp=await companiesSyncTimestamp(db);
  if(!options.refresh&&saved){
    const selectedBasket=saved.details.find(item=>item.name===options.selectedName)??saved.details[0]??null;
    const sourceChanged=sourceStamp!==null&&sourceStamp!==saved.companiesSyncedAt;
    return {...saved,selectedBasket,refreshNeeded:saved.refreshNeeded||sourceChanged||Date.now()-Date.parse(saved.generatedAt)>45*60_000,companiesSyncedAt:sourceStamp};
  }
  if(!options.refresh){
    const cached=await buildFromCache(db,options);
    if(!cached.refreshNeeded)await writeBasketSnapshot(db,cached);
    return cached;
  }

  const {listCompanies}=await import("./investment-data.ts");
  const companies=await listCompanies(db,false);
  const supportedCurrencies:Currency[]=["USD","JPY","GBP","SEK","KRW","CHF"];
  const currencies=[...new Set(companies.filter(company=>company.ticker).map(company=>company.currency.toUpperCase()).filter((currency):currency is Currency=>supportedCurrencies.includes(currency as Currency)))];
  const symbols=[...new Set([...companies.map(company=>company.ticker?yahooSymbolForTicker(company.ticker):"").filter(Boolean),...currencies.map(currency=>fxSymbolForCurrency(currency)).filter((symbol):symbol is string=>Boolean(symbol))])];
  const batchSize=3,totalBatches=Math.ceil(symbols.length/batchSize),batch=Math.max(0,options.batch??0),start=batch*batchSize;
  const key="history:all",now=Date.now();
  let state=await db.prepare("SELECT next_batch,total_batches,force_refresh,refresh_errors,lease_until,updated_at FROM theme_basket_refresh_state WHERE cache_key = ?").bind(key).first<{next_batch:number;total_batches:number;force_refresh:number;refresh_errors:string;lease_until:number|null;updated_at:string}>();
  if(!state||Number(state.next_batch)>=Number(state.total_batches)||now-Date.parse(state.updated_at)>15*60_000){
    if(batch!==0)return {refreshProgress:{nextBatch:0,totalBatches,complete:false}};
    const timestamp=new Date().toISOString(),expiredBefore=new Date(now-15*60_000).toISOString();
    await db.prepare("INSERT INTO theme_basket_refresh_state (cache_key,next_batch,total_batches,force_refresh,refresh_errors,lease_until,updated_at) VALUES (?,?,?,?, '[]',NULL,?) ON CONFLICT(cache_key) DO UPDATE SET next_batch=0,total_batches=excluded.total_batches,force_refresh=excluded.force_refresh,refresh_errors='[]',lease_until=NULL,updated_at=excluded.updated_at WHERE theme_basket_refresh_state.next_batch>=theme_basket_refresh_state.total_batches OR theme_basket_refresh_state.updated_at<?").bind(key,0,totalBatches,options.force?1:0,timestamp,expiredBefore).run();
    state=await db.prepare("SELECT next_batch,total_batches,force_refresh,refresh_errors,lease_until,updated_at FROM theme_basket_refresh_state WHERE cache_key = ?").bind(key).first<{next_batch:number;total_batches:number;force_refresh:number;refresh_errors:string;lease_until:number|null;updated_at:string}>();
    if(!state)throw new Error("Impossible d’initialiser l’actualisation du panier.");
  }
  if(Number(state.next_batch)!==batch)return {refreshProgress:{nextBatch:Number(state.next_batch),totalBatches:Number(state.total_batches),complete:Number(state.next_batch)>=Number(state.total_batches)}};
  const lockUntil=now+25_000;
  const lease=await db.prepare("UPDATE theme_basket_refresh_state SET lease_until=?,updated_at=? WHERE cache_key=? AND next_batch=? AND (lease_until IS NULL OR lease_until<?)").bind(lockUntil,new Date().toISOString(),key,batch,now).run();
  if(Number(lease.meta?.changes??0)!==1)return {refreshProgress:{nextBatch:batch,totalBatches:Number(state.total_batches),complete:false,running:true}};
  const historyCache=await getCachedCompanyHistories(symbols.slice(start,start+batchSize),db);
  const refreshErrors:string[]=[];
  try{
    if(batch<totalBatches){
      await mapLimited(symbols.slice(start,start+batchSize),3,async symbol=>{
        const cached=historyCache.get(symbol);
        const needsRefresh=Boolean(state!.force_refresh)||!cached||!hasYearOfDailyHistory(cached)||Date.now()-Date.parse(cached.fetchedAt)>45*60_000;
        if(!needsRefresh)return;
        try{await getCompanyHistory(symbol,db,true);}catch(error){refreshErrors.push(`${symbol}: ${error instanceof Error?error.message:"échec Yahoo"}`);}
      });
    }
  }catch(error){
    await db.prepare("UPDATE theme_basket_refresh_state SET lease_until=NULL,updated_at=? WHERE cache_key=? AND next_batch=?").bind(new Date().toISOString(),key,batch).run();
    throw error;
  }
  const allErrors=[...(JSON.parse(state.refresh_errors||"[]") as string[]),...refreshErrors];
  const complete=batch>=Number(state.total_batches)-1;
  if(complete){
    const snapshots=await publishBasketSnapshots(db,allErrors);
    const response=snapshots.find(item=>item.dimension===options.dimension&&item.period===options.period)!;
    await db.prepare("UPDATE theme_basket_refresh_state SET next_batch=total_batches,force_refresh=0,lease_until=NULL,updated_at=? WHERE cache_key=? AND next_batch=?").bind(new Date().toISOString(),key,batch).run();
    return {...response,refreshProgress:{nextBatch:totalBatches,totalBatches,complete:true}};
  }
  await db.prepare("UPDATE theme_basket_refresh_state SET next_batch=?,refresh_errors=?,lease_until=NULL,updated_at=? WHERE cache_key=? AND next_batch=?").bind(batch+1,JSON.stringify(allErrors),new Date().toISOString(),key,batch).run();
  return {refreshProgress:{nextBatch:batch+1,totalBatches,complete:false}};
}

export function parseBasketOptions(params:URLSearchParams){
  const dimension=params.get("dimension")==="sector"?"sector":"theme";
  const validPeriods=new Set<string>(basketPeriods);
  const requestedPeriod=params.get("period")??"1y";
  const period=(validPeriods.has(requestedPeriod)?requestedPeriod:"1y") as BasketPeriod;
  const requestedBatch=Number(params.get("batch")??0),batch=Number.isFinite(requestedBatch)?Math.min(1000,Math.max(0,Math.floor(requestedBatch))):0;
  return {dimension,period,selectedName:params.get("basket")??undefined,refresh:params.get("refresh")==="1",force:params.get("force")==="1",batch} as const;
}
