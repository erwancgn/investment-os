import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchYahooHistory, getCachedCompanyHistory, getCompanyHistory, yahooSymbolForTicker } from "../app/lib/quotes.ts";
import { basketPeriods, buildThemeBaskets, parseBasketOptions } from "../app/lib/theme-baskets.ts";

const company=(overrides={})=>({id:"one",name:"One",ticker:"ONE",sector:"Semiconductors",industry:"Semiconductors",ownershipStatus:"Owned",watchlistMembership:false,monitoringStatus:"",businessScore:null,businessVerdict:"",researchStage:"",researchPriority:"",lastAnalysis:null,themes:["AI Infrastructure"],country:"US",currency:"USD",exchange:"NASDAQ",dataCompleteness:"",notionUrl:"",researchReferences:[],...overrides});
const history=(currency,points)=>({providerSymbol:"TEST",currency,fetchedAt:"2026-09-23T00:00:00.000Z",points:points.map(([date,adjustedClose])=>({date,close:adjustedClose,adjustedClose}))});

test("provider mapping preserves standard tickers and maps non-US listings explicitly",()=>{
  assert.equal(yahooSymbolForTicker("NVDA"),"NVDA");
  assert.deepEqual(["ASML","AIXA","SIVE","STM.PA","PRX","SOI","MC","RMS"].map(yahooSymbolForTicker),["ASML.AS","AIXA.DE","SIVE.ST","STMPA.PA","PRX.AS","SOI.PA","MC.PA","RMS.PA"]);
});

test("Yahoo history reads adjusted closes, uses exchange-local dates and validates currencies",async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({chart:{result:[{meta:{symbol:"TEST.PA",currency:"EUR",exchangeTimezoneName:"Europe/Paris"},timestamp:[1790064000],indicators:{quote:[{close:[20]}],adjclose:[{adjclose:[19.5]}]}}]}}));
  try{const result=await fetchYahooHistory("TEST.PA");assert.equal(result.currency,"EUR");assert.equal(result.points[0].adjustedClose,19.5);assert.match(result.points[0].date,/^2026-/);}finally{globalThis.fetch=previous;}
});

test("history cache persists an initial series and subsequent reads do not fetch",async()=>{
  const rows=new Map();
  const db={prepare(sql){return {
    run:async()=>{},
    bind(...values){return {
      first:async()=>rows.get(values[0])??null,
      run:async()=>{if(sql.includes("INSERT INTO quote_history_cache"))rows.set(values[0],{provider_symbol:values[0],currency:values[1],history_json:values[2],fetched_at:values[3]});},
    };},
  };}};
  const previous=globalThis.fetch;let requests=0;
  globalThis.fetch=async url=>{requests++;assert.match(String(url),/range=max/);return new Response(JSON.stringify({chart:{result:[{meta:{symbol:"NVDA",currency:"USD",exchangeTimezoneName:"America/New_York"},timestamp:[1790000000],indicators:{quote:[{close:[120]}],adjclose:[{adjclose:[119]}]}}]}}));};
  try{const first=await getCompanyHistory("NVDA",db);const cached=await getCachedCompanyHistory("NVDA",db);assert.equal(first.points[0].adjustedClose,119);assert.equal(cached.points[0].adjustedClose,119);await getCompanyHistory("NVDA",db);assert.equal(requests,1);}finally{globalThis.fetch=previous;}
});

test("basket is equal-weighted in EUR and reports ownership and coverage",()=>{
  const companies=[company({id:"a",name:"A",ticker:"A"}),company({id:"b",name:"B",ticker:"B",ownershipStatus:"Not owned"})];
  const histories=new Map([["a",history("USD",[["2025-09-23",100],["2026-09-22",120]])],["b",history("EUR",[["2025-09-23",100],["2026-09-22",80]])]]);
  const result=buildThemeBaskets(companies,histories,new Map([["USD",history("USD",[["2025-09-23",1],["2026-09-22",1]])]]),"theme","max","AI Infrastructure");
  assert.equal(result.selectedBasket.returnPercent,0);
  assert.equal(result.selectedBasket.memberCount,2);
  assert.equal(result.selectedBasket.coveredCount,2);
  assert.equal(result.selectedBasket.ownedCount,1);
  assert.equal(result.selectedBasket.series.at(-1).value,100);
});

test("basket conversion uses historical EUR exchange rates",()=>{
  const companyItem=company();
  const histories=new Map([[companyItem.id,history("USD",[["2025-09-23",100],["2026-09-22",110]])]]);
  const fx=new Map([["USD",history("USD",[["2025-09-23",1],["2026-09-22",1.1]])]]);
  const result=buildThemeBaskets([companyItem],histories,fx,"theme","max","AI Infrastructure");
  assert.ok(Math.abs(result.selectedBasket.returnPercent)<1e-9);
});

test("all requested windows calculate from available daily points",()=>{
  const item=company();
  const data=history("EUR",[["2019-01-02",50],["2021-09-20",75],["2024-09-20",80],["2025-09-22",100],["2025-12-31",105],["2026-01-02",106],["2026-09-21",120],["2026-09-22",122]]);
  for(const period of basketPeriods){
    const result=buildThemeBaskets([item],new Map([[item.id,data]]),new Map(),"theme",period,"AI Infrastructure");
    assert.equal(result.selectedBasket.coveredCount,1,`${period} coverage`);
    assert.ok(Number.isFinite(result.selectedBasket.returnPercent),`${period} return`);
  }
});

test("companies without usable history remain visible and lower basket coverage",()=>{
  const companies=[company({id:"priced"}),company({id:"missing",name:"Missing history",ticker:"MISSING",ownershipStatus:"Not owned"})];
  const result=buildThemeBaskets(companies,new Map([["priced",history("EUR",[["2025-09-21",100],["2026-09-22",110]])]]),new Map(),"theme","1y","AI Infrastructure");
  assert.equal(result.selectedBasket.memberCount,2);
  assert.equal(result.selectedBasket.coveredCount,1);
  assert.equal(result.selectedBasket.companies.find(item=>item.id==="missing").returnPercent,null);
});

test("periods and API parameters are restricted to the supported selectors",()=>{
  assert.deepEqual(basketPeriods,["1d","5d","1m","6m","YTD","1y","5y","max"]);
  assert.deepEqual(parseBasketOptions(new URLSearchParams("dimension=sector&period=5y&basket=Semiconductors&refresh=1")),{dimension:"sector",period:"5y",selectedName:"Semiconductors",refresh:true});
  assert.equal(parseBasketOptions(new URLSearchParams("dimension=invalid&period=all")).period,"1y");
});

test("theme basket chart supports touch and keyboard date scrubbing accessibly",async()=>{
  const component=await readFile(new URL("../app/components/theme-baskets.tsx",import.meta.url),"utf8");
  assert.match(component,/onPointerDown=\{event=>\{event\.currentTarget\.setPointerCapture\(event\.pointerId\);indexAt\(event\.clientX\);\}\}/);
  assert.match(component,/onPointerMove=\{event=>\{if\(event\.pointerType==="mouse"\|\|event\.buttons>0\|\|event\.pointerType==="touch"\)indexAt\(event\.clientX\);\}\}/);
  assert.match(component,/event\.key==="ArrowLeft"/);
  assert.match(component,/event\.key==="ArrowRight"/);
  assert.match(component,/event\.key==="Home"/);
  assert.match(component,/event\.key==="End"/);
  assert.match(component,/aria-live="polite"/);
  assert.match(component,/<time dateTime=\{active\.date\}>/);
});
