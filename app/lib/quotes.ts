export type Currency="EUR"|"USD"|"JPY"|"GBP"|"SEK"|"KRW";
export type Instrument={id:string;name:string;yahooSymbol:string;googleSymbol?:string;expectedCurrency:Currency;exchangeTimezone:string};

export type HistoricalPoint={date:string;close:number;adjustedClose:number};
export type CachedHistory={providerSymbol:string;currency:Currency;points:HistoricalPoint[];fetchedAt:string};

const yahooSymbolsByTicker:Record<string,string>={
  "ASML":"ASML.AS","AIXA":"AIXA.DE","SIVE":"SIVE.ST","STM.PA":"STMPA.PA",
  "PRX":"PRX.AS","SOI":"SOI.PA","MC":"MC.PA","RMS":"RMS.PA",
};

export function yahooSymbolForTicker(ticker:string){
  const canonical=ticker.trim().toUpperCase();
  return yahooSymbolsByTicker[canonical]??canonical;
}

const fxSymbols:Record<Exclude<Currency,"EUR">,string>={USD:"EURUSD=X",JPY:"EURJPY=X",GBP:"EURGBP=X",SEK:"EURSEK=X",KRW:"EURKRW=X"};

export function historicalPriceInEur(price:number,currency:Currency,eurPerCurrencyUnit:number){
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(eurPerCurrencyUnit)||eurPerCurrencyUnit<=0)return null;
  return currency==="EUR"?price:price/eurPerCurrencyUnit;
}

export const instruments:Record<string,Instrument>={
  ese:{id:"ese",name:"BNP Easy S&P 500",yahooSymbol:"ESE.PA",googleSymbol:"ESE:EPA",expectedCurrency:"EUR",exchangeTimezone:"Europe/Paris"},
  nvda:{id:"nvda",name:"NVIDIA",yahooSymbol:"NVDA",googleSymbol:"NVDA:NASDAQ",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  tsm:{id:"tsm",name:"TSMC ADR",yahooSymbol:"TSM",googleSymbol:"TSM:NYSE",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  nbis:{id:"nbis",name:"Nebius",yahooSymbol:"NBIS",googleSymbol:"NBIS:NASDAQ",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  msft:{id:"msft",name:"Microsoft",yahooSymbol:"MSFT",googleSymbol:"MSFT:NASDAQ",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  googl:{id:"googl",name:"Alphabet",yahooSymbol:"GOOGL",googleSymbol:"GOOGL:NASDAQ",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  besi:{id:"besi",name:"BESI",yahooSymbol:"BESI.AS",googleSymbol:"BESI:AMS",expectedCurrency:"EUR",exchangeTimezone:"Europe/Amsterdam"},
  sec0:{id:"sec0",name:"ETF Semi",yahooSymbol:"SEC0.DE",googleSymbol:"SEC0:ETR",expectedCurrency:"EUR",exchangeTimezone:"Europe/Berlin"},
  su:{id:"su",name:"Schneider Electric",yahooSymbol:"SU.PA",googleSymbol:"SU:EPA",expectedCurrency:"EUR",exchangeTimezone:"Europe/Paris"},
  visa:{id:"visa",name:"Visa",yahooSymbol:"V",googleSymbol:"V:NYSE",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  spgi:{id:"spgi",name:"S&P Global",yahooSymbol:"SPGI",googleSymbol:"SPGI:NYSE",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  air:{id:"air",name:"Air Liquide",yahooSymbol:"AI.PA",googleSymbol:"AI:EPA",expectedCurrency:"EUR",exchangeTimezone:"Europe/Paris"},
  amzn:{id:"amzn",name:"Amazon",yahooSymbol:"AMZN",googleSymbol:"AMZN:NASDAQ",expectedCurrency:"USD",exchangeTimezone:"America/New_York"},
  advantest:{id:"advantest",name:"Advantest",yahooSymbol:"6857.T",googleSymbol:"6857:TYO",expectedCurrency:"JPY",exchangeTimezone:"Asia/Tokyo"},
  stm:{id:"stm",name:"STMicroelectronics",yahooSymbol:"STMPA.PA",googleSymbol:"STMPA:EPA",expectedCurrency:"EUR",exchangeTimezone:"Europe/Paris"},
  btc:{id:"btc",name:"Bitcoin",yahooSymbol:"BTC-EUR",expectedCurrency:"EUR",exchangeTimezone:"UTC"},
  uber:{id:"uber",name:"Uber",yahooSymbol:"UBER",googleSymbol:"UBER:NYSE",expectedCurrency:"USD",exchangeTimezone:"America/New_York"}
  ,lite:{id:"lite",name:"Lumentum",yahooSymbol:"LITE",googleSymbol:"LITE:NASDAQ",expectedCurrency:"USD",exchangeTimezone:"America/New_York"}
};

const fxInstruments:Record<string,Instrument>={
  "fx-usd":{id:"fx-usd",name:"EUR/USD",yahooSymbol:"EURUSD=X",expectedCurrency:"USD",exchangeTimezone:"UTC"},
  "fx-jpy":{id:"fx-jpy",name:"EUR/JPY",yahooSymbol:"EURJPY=X",expectedCurrency:"JPY",exchangeTimezone:"UTC"},
  "fx-gbp":{id:"fx-gbp",name:"EUR/GBP",yahooSymbol:"EURGBP=X",expectedCurrency:"GBP",exchangeTimezone:"UTC"}
};
const allInstruments={...instruments,...fxInstruments};

export type QuoteView={assetId:string;name:string;nativePrice:number|null;nativeCurrency:string;eurPrice:number|null;fxRate:number|null;fxMarketTime:string|null;previousClose:number|null;changePercent:number|null;marketTime:string|null;fetchedAt:string|null;source:string|null;freshness:"fresh"|"closed"|"stale"|"unavailable";isFallback:boolean;warnings:string[]};
type ProviderQuote={symbol:string;price:number;currency:string;previousClose:number|null;marketTime:string;source:"yahoo-query2"|"yahoo-query1"|"google-finance"};
type CachedQuote={provider:ProviderQuote["source"];provider_symbol:string;native_price:number;native_currency:string;previous_close:number|null;market_time:string;fetched_at:string;validation_flags:string};
const timeout=(ms:number)=>AbortSignal.timeout(ms);
const iso=(seconds:number)=>new Date(seconds*1000).toISOString();
const tableInitialization = new WeakMap<object, Promise<void>>();
const quoteRequests = new WeakMap<object, Map<string, Promise<QuoteView>>>();
const historyTableInitialization=new WeakMap<object,Promise<void>>();

async function fromYahoo(inst:Instrument,host:"query2"|"query1"):Promise<ProviderQuote>{
  const url=`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(inst.yahooSymbol)}?interval=1d&range=5d&includePrePost=false&events=div%2Csplits`;
  const response=await fetch(url,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 InvestmentOS/1.0"},signal:timeout(4500)});
  if(!response.ok)throw new Error(`yahoo_${response.status}`);
  const body=await response.json() as {chart?:{result?:Array<{meta?:Record<string,unknown>}>}};const meta=body.chart?.result?.[0]?.meta;if(!meta)throw new Error("yahoo_empty");
  return {symbol:String(meta.symbol),price:Number(meta.regularMarketPrice),currency:String(meta.currency),previousClose:Number.isFinite(Number(meta.chartPreviousClose))?Number(meta.chartPreviousClose):null,marketTime:iso(Number(meta.regularMarketTime)),source:host==="query2"?"yahoo-query2":"yahoo-query1"};
}
async function fromGoogle(inst:Instrument):Promise<ProviderQuote>{
  if(!inst.googleSymbol)throw new Error("google_unmapped");
  const response=await fetch(`https://www.google.com/finance/quote/${encodeURIComponent(inst.googleSymbol)}?hl=en`,{headers:{accept:"text/html","user-agent":"Mozilla/5.0 InvestmentOS/1.0"},signal:timeout(5000),redirect:"follow"});
  if(!response.ok)throw new Error(`google_${response.status}`);const html=await response.text();if(/consent|captcha/i.test(html)||html.length>2_000_000)throw new Error("google_blocked");
  const price=Number(html.match(/data-last-price="([0-9.]+)"/)?.[1]);const currency=html.match(/data-currency-code="([A-Z]+)"/)?.[1]??"";const timestamp=Number(html.match(/data-last-normal-market-timestamp="([0-9]+)"/)?.[1]);
  if(!price||!currency||!timestamp)throw new Error("google_incomplete");return {symbol:inst.googleSymbol,price,currency,previousClose:null,marketTime:iso(timestamp),source:"google-finance"};
}
function validate(inst:Instrument,q:ProviderQuote){if(!Number.isFinite(q.price)||q.price<=0)throw new Error("invalid_price");if(q.currency!==inst.expectedCurrency)throw new Error(`currency_${q.currency}`);const timestamp=Date.parse(q.marketTime);if(!Number.isFinite(timestamp)||timestamp>Date.now()+120000)throw new Error("invalid_time");}
async function ensureTable(db?:D1Database){
  if(!db)return;
  const key=db as object;
  const existing=tableInitialization.get(key);
  if(existing){await existing;return;}
  const initialization=db.prepare("CREATE TABLE IF NOT EXISTS quote_cache (asset_id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_symbol TEXT NOT NULL, native_price REAL NOT NULL, native_currency TEXT NOT NULL, previous_close REAL, market_time TEXT NOT NULL, fetched_at TEXT NOT NULL, validation_flags TEXT NOT NULL DEFAULT '[]')").run().then(()=>undefined);
  tableInitialization.set(key,initialization);
  try{await initialization;}catch(error){tableInitialization.delete(key);throw error;}
}

async function ensureHistoryTable(db?:D1Database){
  if(!db)return;
  const key=db as object;
  const existing=historyTableInitialization.get(key);
  if(existing){await existing;return;}
  const initialization=db.prepare("CREATE TABLE IF NOT EXISTS quote_history_cache (provider_symbol TEXT PRIMARY KEY, currency TEXT NOT NULL, history_json TEXT NOT NULL, fetched_at TEXT NOT NULL)").run().then(()=>undefined);
  historyTableInitialization.set(key,initialization);
  try{await initialization;}catch(error){historyTableInitialization.delete(key);throw error;}
}

async function readHistory(symbol:string,db?:D1Database):Promise<CachedHistory|null>{
  if(!db)return null;
  await ensureHistoryTable(db);
  const row=await db.prepare("SELECT provider_symbol,currency,history_json,fetched_at FROM quote_history_cache WHERE provider_symbol = ?").bind(symbol).first<{provider_symbol:string;currency:string;history_json:string;fetched_at:string}>();
  if(!row)return null;
  try{
    const points=JSON.parse(row.history_json) as HistoricalPoint[];
    if(!Array.isArray(points))return null;
    return {providerSymbol:row.provider_symbol,currency:row.currency as Currency,points,fetchedAt:row.fetched_at};
  }catch{return null;}
}

async function saveHistory(history:CachedHistory,db?:D1Database){
  if(!db)return;
  await ensureHistoryTable(db);
  await db.prepare("INSERT INTO quote_history_cache (provider_symbol,currency,history_json,fetched_at) VALUES (?,?,?,?) ON CONFLICT(provider_symbol) DO UPDATE SET currency=excluded.currency,history_json=excluded.history_json,fetched_at=excluded.fetched_at")
    .bind(history.providerSymbol,history.currency,JSON.stringify(history.points),history.fetchedAt).run();
}

function yahooMarketDate(timestamp:number,timeZone:string){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(timestamp*1000));
  const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??"";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function fetchYahooHistory(symbol:string,range:"max"|"1mo"="max"):Promise<CachedHistory>{
  const url=`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includePrePost=false&includeAdjustedClose=true&events=div%2Csplits`;
  const response=await fetch(url,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 InvestmentOS/1.0"},signal:timeout(9000)});
  if(!response.ok)throw new Error(`yahoo_history_${response.status}`);
  const body=await response.json() as {chart?:{result?:Array<{meta?:Record<string,unknown>;timestamp?:number[];indicators?:{quote?:Array<{close?:(number|null)[]}>;adjclose?:Array<{adjclose?:(number|null)[]}>}}>;error?:{code?:string;description?:string}|null}};
  const result=body.chart?.result?.[0];
  const meta=result?.meta;
  if(!result||!meta)throw new Error(body.chart?.error?.description||"yahoo_history_empty");
  const providerSymbol=String(meta.symbol??"");
  if(providerSymbol.toUpperCase()!==symbol.toUpperCase())throw new Error(`yahoo_history_symbol_${providerSymbol||"missing"}`);
  const currency=String(meta.currency??"") as Currency;
  if(!["EUR","USD","JPY","GBP","SEK","KRW"].includes(currency))throw new Error(`yahoo_history_currency_${currency||"missing"}`);
  const timezone=String(meta.exchangeTimezoneName??"UTC");
  const quote=result.indicators?.quote?.[0]?.close??[];
  const adjusted=result.indicators?.adjclose?.[0]?.adjclose??[];
  const points=(result.timestamp??[]).flatMap((timestamp,index)=>{
    const close=Number(quote[index]);
    const adjustedClose=Number(adjusted[index]);
    if(!Number.isFinite(close)||close<=0)return [];
    return [{date:yahooMarketDate(timestamp,timezone),close,adjustedClose:Number.isFinite(adjustedClose)&&adjustedClose>0?adjustedClose:close}];
  });
  if(!points.length)throw new Error("yahoo_history_no_prices");
  return {providerSymbol,currency,points,fetchedAt:new Date().toISOString()};
}

export async function getCompanyHistory(ticker:string,db:D1Database,force=false):Promise<CachedHistory>{
  const symbol=yahooSymbolForTicker(ticker);
  const cached=await readHistory(symbol,db);
  if(cached&&!force)return cached;
  const latest=cached?.points.at(-1)?.date;
  const fetched=await fetchYahooHistory(symbol,cached?"1mo":"max");
  const points=latest&&cached
    ? [...new Map([...cached.points,...fetched.points].map(point=>[point.date,point])).values()].sort((a,b)=>a.date.localeCompare(b.date))
    : fetched.points;
  const history={...fetched,points};
  await saveHistory(history,db);
  return history;
}

export async function getCachedCompanyHistory(ticker:string,db:D1Database){
  return readHistory(yahooSymbolForTicker(ticker),db);
}

export function fxSymbolForCurrency(currency:Currency){return currency==="EUR"?null:fxSymbols[currency];}
async function readCache(id:string,db?:D1Database){if(!db)return null;await ensureTable(db);return db.prepare("SELECT * FROM quote_cache WHERE asset_id = ?").bind(id).first<CachedQuote>();}
async function saveCache(id:string,q:ProviderQuote,warnings:string[],db?:D1Database){if(!db)return;await ensureTable(db);await db.prepare("INSERT INTO quote_cache (asset_id,provider,provider_symbol,native_price,native_currency,previous_close,market_time,fetched_at,validation_flags) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(asset_id) DO UPDATE SET provider=excluded.provider,provider_symbol=excluded.provider_symbol,native_price=excluded.native_price,native_currency=excluded.native_currency,previous_close=excluded.previous_close,market_time=excluded.market_time,fetched_at=excluded.fetched_at,validation_flags=excluded.validation_flags").bind(id,q.source,q.symbol,q.price,q.currency,q.previousClose,q.marketTime,new Date().toISOString(),JSON.stringify(warnings)).run();}
function view(inst:Instrument,q:ProviderQuote,fetchedAt:string,warnings:string[]):QuoteView{const age=Date.now()-Date.parse(q.marketTime);const freshness=age<36*3600_000?"fresh":age<7*86400_000?"closed":"stale";const changePercent=q.previousClose?((q.price/q.previousClose)-1)*100:null;return {assetId:inst.id,name:inst.name,nativePrice:q.price,nativeCurrency:q.currency,eurPrice:q.currency==="EUR"?q.price:null,fxRate:q.currency==="EUR"?1:null,fxMarketTime:q.currency==="EUR"?q.marketTime:null,previousClose:q.previousClose,changePercent,marketTime:q.marketTime,fetchedAt,source:q.source,freshness,isFallback:q.source!=="yahoo-query2",warnings};}

async function loadQuote(id:string,force=false,db?:D1Database,cacheOnly=false):Promise<QuoteView>{
  const inst=allInstruments[id];if(!inst)return {assetId:id,name:id,nativePrice:null,nativeCurrency:"",eurPrice:null,fxRate:null,fxMarketTime:null,previousClose:null,changePercent:null,marketTime:null,fetchedAt:null,source:null,freshness:"unavailable",isFallback:false,warnings:["unknown_asset"]};
  const cached=await readCache(id,db);const cacheAge=cached?Date.now()-Date.parse(cached.fetched_at):Infinity;
  if(cached&&(cacheOnly||(!force&&cacheAge<5*60_000))){const q:ProviderQuote={symbol:cached.provider_symbol,price:cached.native_price,currency:cached.native_currency,previousClose:cached.previous_close,marketTime:cached.market_time,source:cached.provider};return {...view(inst,q,cached.fetched_at,JSON.parse(cached.validation_flags||"[]")),...(cacheOnly&&cacheAge>=5*60_000?{freshness:"stale" as const,warnings:["cache_refresh_needed"]}:{})};}
  if(cacheOnly)return {assetId:id,name:inst.name,nativePrice:null,nativeCurrency:inst.expectedCurrency,eurPrice:null,fxRate:null,fxMarketTime:null,previousClose:null,changePercent:null,marketTime:null,fetchedAt:null,source:null,freshness:"unavailable",isFallback:false,warnings:["cache_refresh_needed"]};
  const warnings:string[]=[];for(const provider of [()=>fromYahoo(inst,"query2"),()=>fromYahoo(inst,"query1"),()=>fromGoogle(inst)]){try{const q=await provider();validate(inst,q);await saveCache(id,q,warnings,db);return view(inst,q,new Date().toISOString(),warnings);}catch(error){warnings.push(error instanceof Error?error.message:"provider_error");}}
  if(cached){const q:ProviderQuote={symbol:cached.provider_symbol,price:cached.native_price,currency:cached.native_currency,previousClose:cached.previous_close,marketTime:cached.market_time,source:cached.provider};return {...view(inst,q,cached.fetched_at,warnings),freshness:"stale",isFallback:true};}
  return {assetId:id,name:inst.name,nativePrice:null,nativeCurrency:inst.expectedCurrency,eurPrice:null,fxRate:null,fxMarketTime:null,previousClose:null,changePercent:null,marketTime:null,fetchedAt:null,source:null,freshness:"unavailable",isFallback:true,warnings};
}

async function getQuote(id:string,force=false,db?:D1Database,cacheOnly=false):Promise<QuoteView>{
  if(!db)return loadQuote(id,force,db,cacheOnly);
  const key=db as object;
  const requestKey=`${id}:${cacheOnly?"cache":"live"}:${force?"force":"normal"}`;
  const requests=quoteRequests.get(key)??new Map<string,Promise<QuoteView>>();
  quoteRequests.set(key,requests);
  const existing=requests.get(requestKey);
  if(existing)return existing;
  const request=loadQuote(id,force,db,cacheOnly);
  requests.set(requestKey,request);
  try{return await request;}finally{if(requests.get(requestKey)===request)requests.delete(requestKey);}
}

export async function getQuotes(ids:string[],force=false,db?:D1Database,cacheOnly=false):Promise<QuoteView[]>{
  const currencies=[...new Set(ids.map(id=>allInstruments[id]?.expectedCurrency).filter(c=>c&&c!=="EUR"))];
  const fxIds=currencies.map(currency=>`fx-${currency.toLowerCase()}`).filter(id=>id in fxInstruments);
  const [quotes,fxQuotes]=await Promise.all([
    Promise.all(ids.map(id=>getQuote(id,force,db,cacheOnly))),
    Promise.all(fxIds.map(id=>getQuote(id,force,db,cacheOnly))),
  ]);
  const fxByCurrency=new Map(fxQuotes.map(q=>[q.nativeCurrency,q]));
  return quotes.map(quote=>{if(quote.nativePrice===null||quote.nativeCurrency==="EUR")return quote;const fx=fxByCurrency.get(quote.nativeCurrency);if(!fx?.nativePrice)return {...quote,warnings:[...quote.warnings,`fx_${quote.nativeCurrency}_unavailable`,...(fx?.warnings??[])]};return {...quote,eurPrice:quote.nativePrice/fx.nativePrice,freshness:fx.freshness==="stale"?"stale":quote.freshness,fxRate:fx.nativePrice,fxMarketTime:fx.marketTime,warnings:[...quote.warnings,...fx.warnings.map(w=>`fx:${w}`)]};});
}
