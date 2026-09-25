import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { fetchYahooHistory, fxSymbolForCurrency, getCachedCompanyHistory, getCompanyHistory, yahooSymbolForTicker } from "../app/lib/quotes.ts";
import { basketPeriods, buildThemeBaskets, parseBasketOptions, projectBasketSeries } from "../app/lib/theme-baskets.ts";

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

test("AMS OSRAM Swiss listing and CHF history are supported for EUR basket returns",async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.match(String(url),/chart\/AMS\.SW\?/);
    return new Response(JSON.stringify({chart:{result:[{meta:{symbol:"AMS.SW",currency:"CHF",exchangeTimezoneName:"Europe/Zurich"},timestamp:[1790064000],indicators:{quote:[{close:[10]}],adjclose:[{adjclose:[9.5]}]}}]}}));
  };
  try{
    const result=await fetchYahooHistory("AMS.SW");
    assert.equal(result.currency,"CHF");
    assert.equal(fxSymbolForCurrency(result.currency),"EURCHF=X");
  }finally{globalThis.fetch=previous;}
});

test("Yahoo pence-denominated UK prices normalize to pounds before FX conversion",async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.match(String(url),/chart\/IQE\.L\?/);
    return new Response(JSON.stringify({chart:{result:[{meta:{symbol:"IQE.L",currency:"GBp",exchangeTimezoneName:"Europe/London"},timestamp:[1790064000],indicators:{quote:[{close:[1250]}],adjclose:[{adjclose:[1000]}]}}]}}));
  };
  try{
    const result=await fetchYahooHistory("IQE.L");
    assert.equal(result.currency,"GBP");
    assert.equal(result.points[0].close,12.5);
    assert.equal(result.points[0].adjustedClose,10);
    assert.equal(fxSymbolForCurrency(result.currency),"EURGBP=X");
  }finally{globalThis.fetch=previous;}
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
  globalThis.fetch=async url=>{requests++;assert.match(String(url),/range=5y/);return new Response(JSON.stringify({chart:{result:[{meta:{symbol:"NVDA",currency:"USD",exchangeTimezoneName:"America/New_York"},timestamp:[1790000000],indicators:{quote:[{close:[120]}],adjclose:[{adjclose:[119]}]}}]}}));};
  try{const first=await getCompanyHistory("NVDA",db);const cached=await getCachedCompanyHistory("NVDA",db);assert.equal(first.points[0].adjustedClose,119);assert.equal(cached.points[0].adjustedClose,119);await getCompanyHistory("NVDA",db);assert.equal(requests,1);}finally{globalThis.fetch=previous;}
});

test("monthly max cache is repaired with daily five-year history on refresh",async()=>{
  const monthly=Array.from({length:18},(_,index)=>({date:`${2025+Math.floor(index/12)}-${String(index%12+1).padStart(2,"0")}-01`,close:100,adjustedClose:100}));
  const rows=new Map([["BESI.AS",{provider_symbol:"BESI.AS",currency:"EUR",history_json:JSON.stringify(monthly),fetched_at:new Date().toISOString()}]]);
  const db={prepare(sql){return{run:async()=>{},bind(...values){return{first:async()=>rows.get(values[0])??null,run:async()=>{if(sql.includes("INSERT INTO quote_history_cache"))rows.set(values[0],{provider_symbol:values[0],currency:values[1],history_json:values[2],fetched_at:values[3]});}};}};}};
  const previous=globalThis.fetch;let requested="";
  globalThis.fetch=async url=>{requested=String(url);return new Response(JSON.stringify({chart:{result:[{meta:{symbol:"BESI.AS",currency:"EUR",exchangeTimezoneName:"Europe/Amsterdam"},timestamp:[Date.parse("2025-09-24T12:00:00Z")/1000,Date.parse("2026-09-24T12:00:00Z")/1000],indicators:{quote:[{close:[100,150]}],adjclose:[{adjclose:[100,150]}]}}]}}));};
  try{const result=await getCompanyHistory("BESI.AS",db,true);assert.match(requested,/range=5y/);assert.equal(result.points.find(point=>point.date==="2025-09-24")?.adjustedClose,100);assert.equal(result.points.find(point=>point.date==="2026-09-24")?.adjustedClose,150);}finally{globalThis.fetch=previous;}
});

test("basket is equal-weighted in EUR and reports ownership and coverage",()=>{
  const companies=[company({id:"a",name:"A",ticker:"A"}),company({id:"b",name:"B",ticker:"B",ownershipStatus:"Not owned"})];
  const histories=new Map([["a",history("USD",[["2025-09-23",100],["2026-09-22",120]])],["b",history("EUR",[["2025-09-23",100],["2026-09-22",80]])]]);
  const result=buildThemeBaskets(companies,histories,new Map([["USD",history("USD",[["2025-09-23",1],["2026-09-22",1]])]]),"theme","max","AI Infrastructure");
  assert.equal(result.selectedBasket.returnPercent,0);
  assert.equal(result.selectedBasket.memberCount,2);
  assert.equal(result.selectedBasket.coveredCount,2);
  assert.equal(result.selectedBasket.ownedCount,1);
  assert.match(result.baskets[0].searchText,/A A B B/);
  assert.equal(result.selectedBasket.series.at(-1).value,100);
  assert.equal(buildThemeBaskets(companies,histories,new Map([["USD",history("USD",[["2025-09-23",1],["2026-09-22",1]])]]),"theme","max").selectedBasket.name,"AI Infrastructure");
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
  const data=history("EUR",[["2019-01-02",50],["2021-09-20",75],["2024-09-20",80],["2025-08-21",99],["2025-09-22",100],["2025-12-31",105],["2026-01-02",106],["2026-03-20",109],["2026-08-21",115],["2026-09-15",116],["2026-09-16",117],["2026-09-17",118],["2026-09-18",119],["2026-09-21",120],["2026-09-22",122]]);
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

test("an IPO after the requested one-year start is not assigned a pre-listing return",()=>{
  const companies=[company({id:"listed",name:"Listed",ticker:"LISTED"}),company({id:"spacex",name:"SpaceX",ticker:"SPCX",ownershipStatus:"Not owned"})];
  const histories=new Map([
    ["listed",history("EUR",[["2025-09-22",100],["2026-09-22",110]])],
    ["spacex",history("USD",[["2026-06-12",200],["2026-09-22",260]])],
  ]);
  const result=buildThemeBaskets(companies,histories,new Map([ ["USD",history("USD",[["2026-06-12",1],["2026-09-22",1]])] ]),"theme","1y","AI Infrastructure").selectedBasket;
  assert.equal(result.memberCount,2);
  assert.equal(result.coveredCount,1);
  assert.equal(result.companies.find(item=>item.id==="spacex").returnPercent,null);
});

test("SpaceX is covered only in windows after its June 2026 listing and MAX keeps the shared earlier start",()=>{
  const companies=[company({id:"listed",name:"Listed",ticker:"LISTED"}),company({id:"spacex",name:"SpaceX",ticker:"SPCX",ownershipStatus:"Not owned"}),company({id:"third",name:"Third",ticker:"THIRD",ownershipStatus:"Not owned"})];
  const histories=new Map([
    ["listed",history("EUR",[["2025-09-22",100],["2026-06-12",110],["2026-09-22",120]])],
    ["spacex",history("EUR",[["2026-06-12",200],["2026-09-22",260]])],
    ["third",history("EUR",[["2025-09-22",100],["2026-06-12",105],["2026-09-22",110]])],
  ]);
  const dailyPrices=tickerBase=>Array.from({length:103},(_,index)=>{const date=new Date(Date.UTC(2026,5,12+index));return [date.toISOString().slice(0,10),tickerBase+index/2];});
  const longHistory=base=>[["2021-09-22",base-10],["2025-09-22",base-5],["2025-12-31",base-4],["2026-01-02",base-3],["2026-03-20",base-2],...dailyPrices(base)];
  histories.set("listed",history("EUR",longHistory(110)));
  histories.set("spacex",history("EUR",dailyPrices(200)));
  histories.set("third",history("EUR",longHistory(105)));
  for(const period of ["1d","5d"])assert.equal(buildThemeBaskets(companies,histories,new Map(),"theme",period).details[0].coveredCount,3,`${period} includes SpaceX after listing`);
  const short=buildThemeBaskets(companies,histories,new Map(),"theme","1m").details[0];
  const sixMonths=buildThemeBaskets(companies,histories,new Map(),"theme","6m").details[0];
  const ytd=buildThemeBaskets(companies,histories,new Map(),"theme","YTD").details[0];
  const annual=buildThemeBaskets(companies,histories,new Map(),"theme","1y").details[0];
  const fiveYears=buildThemeBaskets(companies,histories,new Map(),"theme","5y").details[0];
  const maximum=buildThemeBaskets(companies,histories,new Map(),"theme","max").details[0];
  assert.equal(short.coveredCount,3);
  assert.equal(sixMonths.coveredCount,2);
  assert.equal(ytd.coveredCount,2);
  assert.equal(annual.coveredCount,2);
  assert.equal(fiveYears.coveredCount,2);
  assert.equal(maximum.coveredCount,2);
  assert.equal(maximum.companies.find(item=>item.id==="spacex").returnPercent,null);
});

test("MAX chart projection bounds D1 storage while preserving exact endpoints and extrema",()=>{
  const points=Array.from({length:9500},(_,index)=>{
    const date=new Date(Date.UTC(2000,0,1+index)).toISOString().slice(0,10);
    return {date,value:100+Math.sin(index/17)*12+(index===4100?75:0)+(index===7200?-55:0)};
  });
  const item=company({currency:"EUR"});
  const full=buildThemeBaskets([item],new Map([[item.id,history("EUR",points.map(point=>[point.date,point.value]))]]),new Map(),"theme","max").details[0];
  const projected=projectBasketSeries(full.series);
  const multiBasketProjection=Array.from({length:35},()=>projectBasketSeries(full.series));
  assert.ok(projected.length<=400);
  assert.equal(projected[0].date,full.series[0].date);
  assert.equal(projected.at(-1).date,full.series.at(-1).date);
  assert.equal(Math.min(...projected.map(point=>point.value)),Math.min(...full.series.map(point=>point.value)));
  assert.equal(Math.max(...projected.map(point=>point.value)),Math.max(...full.series.map(point=>point.value)));
  assert.ok(Math.abs(full.returnPercent-(projected.at(-1).value-100))<1e-9,"the full-history performance still equals the projected chart endpoint");
  assert.ok(Buffer.byteLength(JSON.stringify(multiBasketProjection))<1_800_000,"35 projected MAX charts fit below the D1 row guard");
});

test("opening baskets reads cached history only and ignores untickered members",async()=>{
  const bundle=await build({entryPoints:["app/lib/theme-baskets.ts"],bundle:true,write:false,platform:"node",format:"esm"});
  const {getThemeBaskets:loadBaskets}=await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  const asProperty=(type,value)=>({type,[type]:value});
  const documents=[
    {page_id:"euro",title:"Euro Co",notion_url:"",properties_json:JSON.stringify({Company:asProperty("title",[{plain_text:"Euro Co"}]),Ticker:asProperty("rich_text",[{plain_text:"EURO"}]),Sector:asProperty("select",{name:"Software"}),Themes:asProperty("multi_select",[{name:"AI Infrastructure"}])})},
    {page_id:"untickered",title:"SpaceX",notion_url:"",properties_json:JSON.stringify({Company:asProperty("title",[{plain_text:"SpaceX"}]),Ticker:asProperty("rich_text",[]),Sector:asProperty("select",{name:"Software"}),Themes:asProperty("multi_select",[{name:"AI Infrastructure"}])})},
  ];
  const cache=new Map([["EURO",{provider_symbol:"EURO",currency:"EUR",history_json:JSON.stringify([{date:"2025-09-22",close:100,adjustedClose:100},{date:"2026-09-22",close:120,adjustedClose:120}]),fetched_at:"2026-09-22T00:00:00.000Z"}]]);
  let historyReads=0,refreshState=null,snapshotValue=null;
  const db={prepare(sql){return{
    run:async()=>({success:true,meta:{changes:1}}),
    all:async()=>({results:sql.includes("source_key='companies'")?documents:[]}),
    bind(...values){return{
      first:async()=>sql.includes("theme_basket_refresh_state")?refreshState:sql.includes("theme_basket_cache")?snapshotValue:sql.includes("quote_history_cache")?cache.get(values[0])??null:null,
      all:async()=>{historyReads++;return{results:values.map(value=>cache.get(value)).filter(Boolean)};},
      run:async()=>{if(sql.includes("INSERT INTO theme_basket_refresh_state"))refreshState={next_batch:values[1],total_batches:values[2],force_refresh:values[3],refresh_errors:"[]",lease_until:null,updated_at:values[4]};if(sql.includes("UPDATE theme_basket_refresh_state SET next_batch=?")){refreshState.next_batch=values[0];refreshState.refresh_errors=values[1];refreshState.updated_at=values[2];refreshState.lease_until=null;}if(sql.includes("INSERT INTO theme_basket_cache"))snapshotValue={value_json:values[1]};return{success:true,meta:{changes:1}};},
    };},
  };}};
  const previous=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error("unexpected network request");};
  try{
    const result=await loadBaskets(db,{dimension:"theme",period:"1y",selectedName:"AI Infrastructure"});
    assert.equal(requests,0);
    assert.equal(result.selectedBasket.returnPercent,20);
    assert.equal(result.selectedBasket.memberCount,2);
    assert.equal(result.selectedBasket.coveredCount,1);
    assert.equal(historyReads,1,"a single D1 query loads equity and FX histories");
    assert.equal(result.selectedBasket.companies.find(item=>item.id==="untickered").returnPercent,null);
    const failedRefresh=await loadBaskets(db,{dimension:"theme",period:"1y",selectedName:"AI Infrastructure",refresh:true});
    assert.equal(requests,1);
    assert.equal(failedRefresh.selectedBasket.returnPercent,20,"a provider failure leaves the cached history in the completed generation");
    assert.equal(failedRefresh.refreshErrors.length,1);
    cache.get("EURO").fetched_at=new Date().toISOString();
    requests=0;
    await loadBaskets(db,{dimension:"theme",period:"1y",selectedName:"AI Infrastructure",refresh:true});
    assert.equal(requests,1,"an automatic refresh repairs an incomplete annual cache even if recently fetched");
    await loadBaskets(db,{dimension:"theme",period:"1y",selectedName:"AI Infrastructure",refresh:true,force:true});
    assert.equal(requests,2,"the manual refresh forces a provider request");
    requests=0;
    const onlyUntickered={prepare(sql){return{
      run:async()=>({success:true,meta:{changes:1}}),
      all:async()=>({results:sql.includes("source_key='companies'")?[documents[1]]:[]}),
      bind(...values){return{first:async()=>sql.includes("theme_basket_refresh_state")?{next_batch:0,total_batches:0,force_refresh:0,refresh_errors:"[]",lease_until:null,updated_at:new Date().toISOString()}:sql.includes("theme_basket_cache")?null:cache.get(values[0])??null,all:async()=>({results:values.map(value=>cache.get(value)).filter(Boolean)}),run:async()=>({success:true,meta:{changes:1}})};},
    };}};
    const untickeredRefresh=await loadBaskets(onlyUntickered,{dimension:"theme",period:"1y",selectedName:"AI Infrastructure",refresh:true});
    assert.equal(requests,0,"an untickered-only basket needs neither Yahoo history nor FX");
    assert.equal(untickeredRefresh.selectedBasket.returnPercent,null);
  }finally{globalThis.fetch=previous;}
});

test("a saved snapshot serves every basket selection without quote-history reads",async()=>{
  const bundle=await build({entryPoints:["app/lib/theme-baskets.ts"],bundle:true,write:false,platform:"node",format:"esm"});
  const {getThemeBaskets:loadBaskets}=await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  const detail=name=>({name,returnPercent:12,memberCount:1,coveredCount:1,ownedCount:0,startDate:"2025-09-22",endDate:"2026-09-22",series:[{date:"2025-09-22",value:100},{date:"2026-09-22",value:112}],companies:[]});
  const snapshot={generatedAt:new Date().toISOString(),dimension:"theme",period:"1y",baskets:[{name:"First",returnPercent:12,memberCount:1,coveredCount:1,ownedCount:0,startDate:"2025-09-22",endDate:"2026-09-22",searchText:""},{name:"Second",returnPercent:12,memberCount:1,coveredCount:1,ownedCount:0,startDate:"2025-09-22",endDate:"2026-09-22",searchText:""}],details:[detail("First"),detail("Second")],selectedBasket:detail("First"),refreshErrors:["OLD: Yahoo unavailable"],refreshNeeded:true,companiesSyncedAt:"sync-1"};
  let historyReads=0,companiesStamp="sync-1";
  const db={prepare(sql){return{run:async()=>({success:true,meta:{changes:1}}),all:async()=>({results:[]}),first:async()=>sql.includes("notion_sync_state")?{last_completed_at:companiesStamp}:null,bind(){return{first:async()=>sql.includes("theme_basket_cache")?{value_json:JSON.stringify(snapshot)}:null,all:async()=>{historyReads++;return{results:[]};},run:async()=>({success:true})};}};}};
  const previous=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error("snapshot reads must not contact Yahoo");};
  try{
    const result=await loadBaskets(db,{dimension:"theme",period:"1y",selectedName:"Second"});
    assert.equal(result.selectedBasket.name,"Second");
    assert.equal(result.refreshNeeded,true,"the next session retries a previously incomplete provider refresh");
    assert.equal(historyReads,0);
    assert.equal(requests,0);
    companiesStamp="sync-2";
    const invalidated=await loadBaskets(db,{dimension:"theme",period:"1y"});
    assert.equal(invalidated.refreshNeeded,true,"a completed Companies sync immediately marks the snapshot for revalidation");
  }finally{globalThis.fetch=previous;}
});

test("a Yahoo symbol failure keeps cached coverage and is recorded in the published complete attempt",async()=>{
  const bundle=await build({entryPoints:["app/lib/theme-baskets.ts"],bundle:true,write:false,platform:"node",format:"esm"});
  const {getThemeBaskets:loadBaskets}=await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].text).toString("base64"));
  const documents=["A","B"].map(ticker=>({page_id:ticker,title:ticker,notion_url:"",properties_json:JSON.stringify({Company:{type:"title",title:[{plain_text:ticker}]},Ticker:{type:"rich_text",rich_text:[{plain_text:ticker}]},Themes:{type:"multi_select",multi_select:[{name:"AI Infrastructure"}]}})}));
  let published=0,requests=0,refreshState=null,historyReads=0;const snapshotKeys=[],snapshots=new Map();
  const db={prepare(sql){return{
    run:async()=>({success:true,meta:{changes:1}}),
    all:async()=>({results:sql.includes("source_key='companies'")?documents:[]}),
    bind(...values){return{first:async()=>sql.includes("theme_basket_refresh_state")?refreshState:sql.includes("theme_basket_cache")?({value_json:snapshots.get(values[0])}):null,all:async()=>{if(sql.includes("quote_history_cache"))historyReads++;return{results:[]};},run:async()=>{if(sql.includes("INSERT INTO theme_basket_refresh_state"))refreshState={next_batch:values[1],total_batches:values[2],force_refresh:values[3],refresh_errors:"[]",lease_until:null,updated_at:values[4]};if(sql.includes("INSERT INTO theme_basket_cache")){published++;snapshotKeys.push(values[0]);snapshots.set(values[0],values[1]);}if(sql.includes("UPDATE theme_basket_refresh_state SET next_batch=?")){refreshState.next_batch=values[0];refreshState.refresh_errors=values[1];refreshState.updated_at=values[2];refreshState.lease_until=null;}return{success:true,meta:{changes:1}};}};},
  };}};
  const previous=globalThis.fetch;globalThis.fetch=async()=>{requests++;throw Error("Yahoo unavailable");};
  try{
    const result=await loadBaskets(db,{dimension:"theme",period:"1y",refresh:true});
    assert.ok(requests>0);
    assert.equal(published,16,"one history refresh publishes both dimensions across all eight periods");
    assert.equal(new Set(snapshotKeys).size,16,"every basket view gets its own completed snapshot");
    assert.ok(result.refreshErrors.length>0);
    const completedReads=historyReads;
    const switched=await loadBaskets(db,{dimension:"sector",period:"max"});
    assert.equal(switched.dimension,"sector");
    assert.equal(switched.period,"max");
    assert.equal(historyReads,completedReads,"changing dimensions and period reads the published snapshot without scanning quote histories");
  }finally{globalThis.fetch=previous;}
});

test("stale FX is not silently applied to a current equity history",()=>{
  const item=company();
  const histories=new Map([[item.id,history("USD",[["2026-09-15",100],["2026-09-22",110]])]]);
  const fx=new Map([["USD",history("USD",[["2026-09-01",1],["2026-09-02",1]])]]);
  const result=buildThemeBaskets([item],histories,fx,"theme","1m","AI Infrastructure").selectedBasket;
  assert.equal(result.coveredCount,0);
  assert.equal(result.returnPercent,null);
});

test("periods and API parameters are restricted to the supported selectors",()=>{
  assert.deepEqual(basketPeriods,["1d","5d","1m","6m","YTD","1y","5y","max"]);
  assert.deepEqual(parseBasketOptions(new URLSearchParams("dimension=sector&period=5y&basket=Semiconductors&refresh=1&force=1&batch=3")),{dimension:"sector",period:"5y",selectedName:"Semiconductors",refresh:true,force:true,batch:3});
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
  assert.match(component,/theme-basket-chart-zero/);
  assert.match(component,/theme-basket-chart-area-positive/);
  assert.match(component,/theme-basket-chart-area-negative/);
  assert.match(component,/theme-basket-chart-axis/);
  assert.match(component,/theme-basket-chart-date/);
  assert.match(component,/theme-basket-chart-tooltip/);
  assert.match(component,/Date\.parse\(`\$\{point\.date\}T12:00:00Z`\)/);
  assert.match(component,/minValue<0&&maxValue>0\?\[maxValue,0,minValue\]/);
  assert.match(component,/middleTime=firstTime\+timeSpan\/2/);
  assert.match(component,/left:`clamp\(4\.5rem,/);
  assert.match(component,/view\?\.details\.find\(item=>item\.name===requestedBasketName\)/);
  assert.doesNotMatch(component,/snapshot=1|setInterval\(\(\)=>void readUpdatedCache,2500\)/);
  assert.match(component,/refreshThemeBasketCache\(force\)/);
  assert.match(component,/Période d’exemple/);
  assert.match(component,/clôtures locales/);
  assert.match(component,/company\.id\.startsWith\("demo-"\)/);
  assert.match(component,/<Badge>Données fictives<\/Badge>/);
  assert.match(component,/isDemo\?"exemples":"historiques"/);
  assert.match(component,/document\.visibilityState!=="visible"/);
  assert.match(component,/getClientRects\(\)\.length/);
  assert.match(component,/setInterval\(refreshIfDue,45\*60\*1000\)/);
  assert.match(component,/Date\.now\(\)-lastRefreshAt\.current<45\*60\*1000/);
});
