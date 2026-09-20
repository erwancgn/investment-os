"use client";
import { useState, type ReactNode } from "react";
import type { LivePortfolio } from "../lib/investment-data";
import { CompactControl, PrimaryBlock, ProgressBar } from "./ui-primitives";

const eur = (value:number|null) => value == null ? "—" : new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);
const positionTitle = (value:string) => value.replace(/\s+[—–-]\s+(?:CTO|PEA)\s*$/i,"").trim();
type PortfolioScope = "total"|"CTO"|"PEA";
type ExposureMode = "sectors"|"themes";
type ExposureView = "sector"|"country";
type PositionSort = "marketValue"|"pnlEur"|"pnlPercent"|"weight";
type PnlDisplayMode = "percent"|"eur";
const exposureColors=["#6ee7b7","#5d8df0","#d5a65f","#a37ee8","#fb8a8a","#67e8f9","#f3a45f","#f8d66d"];
const sectorLabels:Record<string,string>={
  "Information Technology":"Technology",
  "Technology":"Technology",
  "Financial Services":"Financials",
  "Financials":"Financials",
  "Health Care":"Healthcare",
  "Healthcare":"Healthcare",
  "Consumer":"Consumer Discretionary",
  "Consumer Discretionary":"Consumer Discretionary",
  "Consumer Staples":"Consumer Staples",
  "Communication Services":"Communication Services",
  "Industrials":"Industrials",
  "Energy":"Energy",
  "Materials":"Materials",
  "Utilities":"Utilities",
  "Real Estate":"Real Estate"
};
const normalizedSector=(sector:string)=>(sectorLabels[sector.trim()]??sector.trim())||"Autres";
function sectorBuckets(positions:LivePortfolio["positions"]){
  const map=new Map<string,number>();
  for(const position of positions){
    const value=position.marketValueEur??0;
    if(position.sectorExposures.length){
      for(const exposure of position.sectorExposures){const key=normalizedSector(exposure.name);map.set(key,(map.get(key)??0)+value*exposure.weight);}
    }else{
      const key=normalizedSector(position.sector||"Autres");map.set(key,(map.get(key)??0)+value);
    }
  }
  const total=positions.reduce((sum,position)=>sum+(position.marketValueEur??0),0);
  return [...map.entries()].map(([name,valueEur])=>({name,valueEur,weight:total?valueEur/total*100:0})).sort((a,b)=>b.valueEur-a.valueEur);
}
function themeBuckets(positions:LivePortfolio["positions"]){
  const map=new Map<string,number>();
  const total=positions.reduce((sum,position)=>sum+(position.marketValueEur??0),0);
  for(const position of positions){
    const value=position.marketValueEur??0;
    const key=position.primaryTheme||"Non ventilé thématiquement";
    map.set(key,(map.get(key)??0)+value);
  }
  return [...map.entries()].map(([name,valueEur])=>({name,valueEur,weight:total?valueEur/total*100:0})).sort((a,b)=>b.valueEur-a.valueEur);
}
function geographicBuckets(positions:LivePortfolio["positions"]){
  const map=new Map<string,number>();
  const add=(name:string,value:number)=>map.set(name,(map.get(name)??0)+value);
  for(const position of positions){
    const value=position.marketValueEur??0;
    if(position.countryExposures.length){
      for(const exposure of position.countryExposures)add(exposure.name,value*exposure.weight);
    }else if(position.country){
      add(position.country,value);
    }else{
      add("Autres",value);
    }
  }
  const total=positions.reduce((sum,position)=>sum+(position.marketValueEur??0),0);
  const countries:[string,number][]=[];
  let otherValue=0;
  for(const [name,valueEur] of map){
    const weight=total?valueEur/total*100:0;
    if(name==="Autres"||weight<1)otherValue+=valueEur;
    else countries.push([name,valueEur]);
  }
  if(otherValue>0)countries.push(["Autres",otherValue]);
  return countries.map(([name,valueEur])=>({name,valueEur,weight:total?valueEur/total*100:0})).sort((a,b)=>b.valueEur-a.valueEur);
}
const exposureColor=(name:string,index:number)=>name==="Non ventilé thématiquement"?"#c8cecb":exposureColors[index%exposureColors.length];
function donutGradient(items:{name:string;weight:number}[]){let cursor=0;const stops=items.map((item,index)=>{const start=cursor;cursor+=item.weight;return `${exposureColor(item.name,index)} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;});return `conic-gradient(${stops.join(",")||"#2b3a34 0 100%"})`;}
type LivePortfolioDashboardProps = { data: LivePortfolio | null; loading: boolean; error: string; onRefresh: () => void; openCompany: (companyId?: string) => void; beforeDiagnostic?: ReactNode };

export function LivePortfolioDashboard({ data, loading, error, onRefresh, openCompany, beforeDiagnostic }: LivePortfolioDashboardProps){
  const [accountFilter,setAccountFilter]=useState("Toutes");const [scope,setScope]=useState<PortfolioScope>("total");const [sortBy,setSortBy]=useState<PositionSort>("weight");const [sortDirection,setSortDirection]=useState<"desc"|"asc">("desc");const [exposureView,setExposureView]=useState<ExposureView>("sector");const [exposureMode,setExposureMode]=useState<ExposureMode>("sectors");const [pnlDisplayMode,setPnlDisplayMode]=useState<PnlDisplayMode>("percent");
  if(!data)return <PrimaryBlock as="section" className="live-portfolio-state"><strong>{loading?"Calcul du portefeuille en cours…":"Portefeuille indisponible"}</strong><span>{error||"Lecture des dernières données disponibles."}</span>{!loading&&<button onClick={onRefresh}>Réessayer</button>}</PrimaryBlock>;
  const chartPositions=scope==="total"?data.positions:data.positions.filter(item=>item.account===scope);
  const exposureItems=exposureView==="country"?geographicBuckets(chartPositions):exposureMode==="themes"?themeBuckets(chartPositions):sectorBuckets(chartPositions);
  const topExposure=exposureItems[0];
  const visibleExposureItems=exposureItems.map((item,index)=>({...item,color:exposureColor(item.name,index)})).filter(item=>item.weight>=1);
  const themeCoverage=100-(exposureItems.find(item=>item.name==="Non ventilé thématiquement")?.weight??0);
  const exposureSummary=exposureView==="sector"&&exposureMode==="themes"?{weight:themeCoverage,name:"Thématisé"}:topExposure;
  const accounts=["Toutes",...new Set(data.positions.map(item=>item.account).filter(Boolean))];
  const visiblePositions=[...data.positions].filter(item=>accountFilter==="Toutes"||item.account===accountFilter).sort((a,b)=>{const value=(item:typeof a)=>sortBy==="marketValue"?(item.marketValueEur??-Infinity):sortBy==="pnlEur"?(item.pnlEur??-Infinity):sortBy==="pnlPercent"?(item.pnlPercent??-Infinity):(item.weight??-Infinity);const diff=value(a)-value(b);return sortDirection==="desc"?-diff:diff});
  // Cash is one strategic allocation, even when Notion stores it on multiple
  // account rows. Keep account-level rows in diagnostics/slices, but present a
  // single PEA + CTO line in the main allocation list.
  const allocationPositions=(()=>{
    if(accountFilter!=="Toutes")return visiblePositions;
    const cashRows=visiblePositions.filter(item=>item.instrumentType.toLowerCase()==="cash"||item.name.toLowerCase().startsWith("cash"));
    if(cashRows.length<2)return visiblePositions;
    const cashValue=cashRows.reduce((sum,item)=>sum+(item.marketValueEur??0),0);
    const cashWeight=cashRows.reduce((sum,item)=>sum+(item.weight??0),0);
    const first=cashRows[0];
    const cash={...first,id:"cash-global",name:"Cash",account:"PEA + CTO",quantity:cashRows.reduce((sum,item)=>sum+item.quantity,0),marketValueEur:cashValue,pnlEur:0,pnlPercent:null,brokerPnlEur:0,brokerPnlPercent:null,weight:cashWeight,targetWeight:first.targetWeight||3,targetEur:first.targetEur||300,target10kWeight:first.target10kWeight||3,target10kEur:first.target10kEur||300,pruEur:null,brokerPruEur:null,pruSource:"missing" as const,eurPrice:1,nativePrice:1,nativeCurrency:"EUR",fxRate:1,fxMarketTime:null,quoteSymbol:null,quoteSource:"cash",quoteFreshness:"fresh",marketTime:null,companyIds:[],notionUrl:"",warning:null};
    return [...visiblePositions.filter(item=>!cashRows.includes(item)),cash];
  })();
  // Keep the progress scale stable: each bar is the line's share of the whole portfolio.
  const positionProgressMax=100;
  const slice=data.slices?.[scope]??data.slices?.total??data.totals;
  const sliceCost=slice.costBasisEur;
  const slicePnl=slice.pnlEur;
  const slicePnlPercent=slice.pnlPercent;
  const quantityLabel=(quantity:number,type:string)=>type.toLowerCase()==="cash"?`${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(quantity)} € disponibles`:`${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:4}).format(quantity)} ${quantity>1?"titres":"titre"}`;
  const pnlLabel=(value:number|null)=>value==null?"—":`${value>=0?"+":""}${value.toFixed(1)}%`;
  return <>{data.refreshPending&&<p role="status">Dernières valeurs disponibles · actualisation des cours en cours.</p>}{data.coverage.unavailable>0&&<p role="status">Valorisation incomplète : certaines lignes ne disposent pas de cours.</p>}
    <div className="live-dashboard-head"><span>{data.coverage.live} live · {data.coverage.manual} manuel · {data.coverage.cash} cash{data.coverage.stale?` · ${data.coverage.stale} obsolète`:""}{data.coverage.unavailable?` · ${data.coverage.unavailable} indisponible`:""} · {data.coverage.total} lignes</span><span>{data.quoteAsOf?`Dernier marché ${new Date(data.quoteAsOf).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`:""}</span><button onClick={onRefresh} disabled={loading} title="Rafraîchir les cours et recalculer le portefeuille" aria-label="Rafraîchir les cours et recalculer le portefeuille">{loading?"Actualisation…":"↻ Actualiser"}</button></div>
    <PrimaryBlock as="section" className="portfolio-overview" aria-label="Synthèse du portefeuille"><div className="portfolio-overview-main"><div><p className="eyebrow">Portefeuille · {scope==="total"?"Total":scope}</p><span>Valeur actuelle</span><strong>{eur(slice.marketValueEur)}</strong><small>{slice.positions} positions · cours convertis en euros</small></div><div className="portfolio-kpis"><span><small>Plus-value latente</small><strong className={slicePnl>=0?"positive":"negative"}>{slicePnlPercent==null?"—":`${slicePnlPercent>=0?"+":""}${slicePnlPercent.toFixed(1)}%`}</strong><b className={slicePnl>=0?"positive":"negative"}>{slicePnl>=0?"+":""}{eur(slicePnl)}</b></span><span><small>Capital investi</small><strong>{eur(sliceCost)}</strong><b>hors cash</b></span><span><small>Cash disponible</small><strong>{eur(slice.cashValueEur)}</strong><b>{scope==="total"?"PEA + CTO":scope}</b></span></div></div><div className="portfolio-scope-switch" aria-label="Choisir le périmètre du portefeuille">{(["total","CTO","PEA"] as PortfolioScope[]).map(key=>{const item=data.slices?.[key]??data.totals;const label=key==="total"?"Total PF":key;return <button key={key} className={scope===key?"active":""} onClick={()=>setScope(key)}><span>{label}</span><strong>{eur(item.marketValueEur)}</strong></button>})}</div></PrimaryBlock>
    <section className="dashboard-grid portfolio-main-grid"><PrimaryBlock as="article" className="allocation-panel"><div className="panel-head"><div><p className="eyebrow">Portefeuille</p><h2>Positions actives</h2></div><span className="position-count">{allocationPositions.length} ligne{allocationPositions.length>1?"s":""}</span></div><div className="portfolio-controls-row" aria-label="Filtrer et trier les positions">
        <label htmlFor="portfolio-account-filter">Enveloppe</label>
        <CompactControl
          variant="select"
          id="portfolio-account-filter"
          className="portfolio-account-control"
          ariaLabel="Filtrer par enveloppe"
          value={accountFilter}
          onChange={setAccountFilter}
          options={accounts.map((account) => ({ value: account, label: account }))}
        />
        <span className="portfolio-control-separator" aria-hidden="true">/</span>
        <label htmlFor="position-sort">Trier</label>
        <CompactControl
          variant="select"
          id="position-sort"
          className="portfolio-sort-control"
          ariaLabel="Trier les positions"
          value={sortBy}
          onChange={(value) => setSortBy(value as PositionSort)}
          options={[
            { value: "weight", label: "Poids" },
            { value: "marketValue", label: "Montant" },
            { value: "pnlEur", label: "Plus-value €" },
            { value: "pnlPercent", label: "Plus-value %" },
          ]}
        />
        <CompactControl
          variant="icon"
          className="portfolio-sort-direction"
          onClick={() => setSortDirection((value) => value === "desc" ? "asc" : "desc")}
          ariaLabel={`Ordre ${sortDirection === "desc" ? "décroissant" : "croissant"}`}
          title={sortDirection === "desc" ? "Ordre décroissant" : "Ordre croissant"}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d={sortDirection === "desc" ? "M8 3v10m0 0 3-3m-3 3-3-3" : "M8 13V3m0 0 3 3M8 3 5 6"} />
          </svg>
        </CompactControl>
      </div><div className="allocation-list">{allocationPositions.map(item=>{const title=positionTitle(item.name);const companyId=item.companyIds[0];const clickable=Boolean(companyId);const itemPnl=item.pnlEur;const itemPru=item.pruEur;return <div className={`allocation-row ${clickable?"clickable":""}`} key={item.id}>{companyId&&<button type="button" className="position-open" aria-label={`Ouvrir la fiche ${title}`} onClick={()=>openCompany(companyId)}/>}<div className="asset-name"><span className="asset-dot green">{title.slice(0,2).toUpperCase()}</span><div><strong>{title}</strong><small className="asset-metadata"><span>{item.account||"Sans enveloppe"}</span><span>{quantityLabel(item.quantity,item.instrumentType)}</span><span>PRU {itemPru==null?"—":eur(itemPru)}</span></small></div></div><ProgressBar value={item.weight} max={positionProgressMax} tone="accent" className="allocation-progress" label={`Poids ${title}`}/><div className="weights"><strong>{item.weight?.toFixed(1)??"—"}%</strong><small>Poids PF</small></div><div className="position-value"><small>Valeur</small><strong>{eur(item.marketValueEur)}</strong></div><div className="position-quote"><small>Cours EUR</small><strong>{eur(item.eurPrice)}</strong></div><button type="button" className={`pnl-badge ${itemPnl==null?"neutral":itemPnl>=0?"positive-pnl":"negative-pnl"}`} aria-label={`Afficher la plus-value de ${title} en ${pnlDisplayMode==="percent"?"euros":"pourcentage"}`} title="Cliquer pour basculer entre plus-value en pourcentage et en euros" onClick={event=>{event.stopPropagation();setPnlDisplayMode(mode=>mode==="percent"?"eur":"percent")}}><strong>{pnlDisplayMode==="percent"?pnlLabel(item.pnlPercent):itemPnl==null?"—":`${itemPnl>=0?"+":""}${eur(itemPnl)}`}</strong></button></div>})}</div></PrimaryBlock>
      <div className="side-stack"><PrimaryBlock as="article" className="sector-panel">
        <div className="panel-head exposure-panel-head"><div className="exposure-panel-heading"><p className="eyebrow">Exposition</p><div className="sector-panel-controls"><CompactControl
          variant="select"
          className="exposure-view-select"
          ariaLabel="Dimension de l’exposition"
          value={exposureView}
          onChange={(value) => setExposureView(value as ExposureView)}
          options={[
            { value: "sector", label: "Par secteur" },
            { value: "country", label: "Par pays" },
          ]}
        />{exposureView==="sector"&&<CompactControl
          variant="select"
          className="exposure-detail-select"
          ariaLabel="Type d’exposition"
          value={exposureMode}
          onChange={(value) => setExposureMode(value as ExposureMode)}
          options={[
            { value: "sectors", label: "Secteurs" },
            { value: "themes", label: "Thèmes" },
          ]}
        />}</div></div></div>
        <div className="donut-wrap"><div className="donut live-donut" style={{background:donutGradient(exposureItems)}}><div><strong>{exposureSummary?.weight.toFixed(1)??"0"}%</strong><small>{exposureSummary?.name??"—"}</small></div></div><ul className="sector-list">{visibleExposureItems.map(item=><li key={item.name}><i style={{background:item.color}}/><span>{item.name}</span><strong>{item.weight.toFixed(1)}%</strong></li>)}</ul></div>
      </PrimaryBlock></div>
    </section>
    {beforeDiagnostic}
  </>;
}
