import type { CompanyListItem } from "./investment-data.ts";
import {
  fxSymbolForCurrency,
  getCachedCompanyHistory,
  getCompanyHistory,
  historicalPriceInEur,
  type CachedHistory,
  type Currency,
  type HistoricalPoint,
} from "./quotes.ts";

export type BasketDimension="sector"|"theme";
export type BasketPeriod="1d"|"5d"|"1m"|"6m"|"YTD"|"1y"|"5y"|"max";
export const basketPeriods:BasketPeriod[]=["1d","5d","1m","6m","YTD","1y","5y","max"];
type CompanyPerformance={id:string;name:string;ticker:string;ownershipStatus:CompanyListItem["ownershipStatus"];sector:string;themes:string[];returnPercent:number|null};
export type BasketSummary={name:string;returnPercent:number|null;memberCount:number;coveredCount:number;ownedCount:number;startDate:string|null;endDate:string|null};
export type BasketDetail=BasketSummary&{series:{date:string;value:number}[];companies:CompanyPerformance[]};
export type ThemeBasketResponse={generatedAt:string;dimension:BasketDimension;period:BasketPeriod;baskets:BasketSummary[];selectedBasket:BasketDetail|null;refreshErrors:string[]};

type CompanySeries={company:CompanyListItem;eurPrices:Map<string,number>};
const staleAfter=6*60*60*1000;
const normalized=(value:string)=>value.trim().replace(/\s+/g," ");

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

function fxAtOrBefore(points:HistoricalPoint[],date:string){
  const point=pointAtOrBefore(points,date);
  return point?.adjustedClose??null;
}

function companyPricesInEur(history:CachedHistory,fxHistory:CachedHistory|null){
  const prices=new Map<string,number>();
  for(const point of history.points){
    const fx=history.currency==="EUR"?1:fxHistory?fxAtOrBefore(fxHistory.points,point.date):null;
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
  const commonMaxStart=period==="max"?series.map(item=>item.eurPrices.keys().next().value as string|undefined).filter((date):date is string=>Boolean(date)).sort().at(-1)??requestedStart:requestedStart;
  const baseDate=period==="1d"||period==="5d"?shortWindowStart??requestedStart:commonMaxStart;
  const endDate=latest;
  const prepared=series.flatMap(item=>{
    const points=[...item.eurPrices.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,close:value,adjustedClose:value}));
    const base=pointAtOrBefore(points,baseDate);
    const end=pointAtOrBefore(points,endDate);
    if(!base||!end||base.date===end.date)return [];
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

export function buildThemeBaskets(companies:CompanyListItem[],histories:Map<string,CachedHistory>,fxHistories:Map<Currency,CachedHistory>,dimension:BasketDimension,period:BasketPeriod,selectedName?:string):Pick<ThemeBasketResponse,"baskets"|"selectedBasket">{
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
  const baskets=details.map(item=>({name:item.name,returnPercent:item.returnPercent,memberCount:item.memberCount,coveredCount:item.coveredCount,ownedCount:item.ownedCount,startDate:item.startDate,endDate:item.endDate}));
  const selectedBasket=details.find(item=>item.name===selectedName)??null;
  return {baskets,selectedBasket};
}

async function mapLimited<T,R>(items:T[],limit:number,run:(item:T)=>Promise<R>):Promise<R[]>{
  const results=new Array<R>(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const index=next++;if(index>=items.length)return;results[index]=await run(items[index]);}}));
  return results;
}

export async function getThemeBaskets(db:D1Database,options:{dimension:BasketDimension;period:BasketPeriod;selectedName?:string;refresh?:boolean}) :Promise<ThemeBasketResponse>{
  const {listCompanies}=await import("./investment-data.ts");
  const companies=await listCompanies(db,false);
  const refreshErrors:string[]=[];
  const histories=new Map<string,CachedHistory>();
  const cached=await Promise.all(companies.map(company=>company.ticker?getCachedCompanyHistory(company.ticker,db):Promise.resolve(null)));
  const shouldRefresh=Boolean(options.refresh)||cached.some(history=>!history||Date.now()-Date.parse(history.fetchedAt)>staleAfter);
  const loaded=shouldRefresh
    ? await mapLimited(companies,3,async(company)=>{
      if(!company.ticker)return null;
      const index=companies.indexOf(company);
      const needsRefresh=Boolean(options.refresh)||!cached[index]||Date.now()-Date.parse(cached[index]!.fetchedAt)>staleAfter;
      if(!needsRefresh)return cached[index];
      try{return await getCompanyHistory(company.ticker,db,true);}catch(error){refreshErrors.push(`${company.name}: ${error instanceof Error?error.message:"échec Yahoo"}`);return cached[index];}
    })
    : cached;
  loaded.forEach((history,index)=>{if(history)histories.set(companies[index].id,history);});
  const currencies=[...new Set([...histories.values()].map(history=>history.currency).filter((currency):currency is Currency=>currency!=="EUR"))];
  const fxHistories=new Map<Currency,CachedHistory>();
  await mapLimited(currencies,3,async(currency)=>{
    const symbol=fxSymbolForCurrency(currency);
    if(!symbol)return;
    try{
      const fx=shouldRefresh?await getCompanyHistory(symbol,db,true):await getCachedCompanyHistory(symbol,db);
      if(fx)fxHistories.set(currency,fx);
    }catch(error){refreshErrors.push(`${currency}/EUR: ${error instanceof Error?error.message:"échec Yahoo"}`);}
  });
  const calculated=buildThemeBaskets(companies,histories,fxHistories,options.dimension,options.period,options.selectedName);
  return {generatedAt:new Date().toISOString(),dimension:options.dimension,period:options.period,...calculated,refreshErrors};
}

export function parseBasketOptions(params:URLSearchParams){
  const dimension=params.get("dimension")==="sector"?"sector":"theme";
  const validPeriods=new Set<string>(basketPeriods);
  const requestedPeriod=params.get("period")??"1y";
  const period=(validPeriods.has(requestedPeriod)?requestedPeriod:"1y") as BasketPeriod;
  return {dimension,period,selectedName:params.get("basket")??undefined,refresh:params.get("refresh")==="1"} as const;
}
