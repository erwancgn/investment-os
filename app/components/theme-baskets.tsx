"use client";

import { useEffect, useRef, useState } from "react";
import { useClientResource } from "../lib/client-resource";
import { basketPeriods, type BasketDimension, type BasketPeriod, type ThemeBasketResponse } from "../lib/theme-baskets";
import { ActionButton, AsyncState, Badge, CompactControl, PrimaryBlock, SearchField } from "./ui-primitives";

const periodLabels:Record<BasketPeriod,string>={"1d":"1D","5d":"5D","1m":"1M","6m":"6M",YTD:"YTD","1y":"1Y","5y":"5Y",max:"MAX"};
const percent=(value:number|null)=>value==null?"—":`${value>0?"+":""}${new Intl.NumberFormat("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1}).format(value)} %`;
const dimensionOptions=[{value:"sector",label:"Secteurs"},{value:"theme",label:"Thèmes"}];
const periodOptions=basketPeriods.map(value=>({value,label:periodLabels[value]}));
const sortOptions=[{value:"return",label:"Performance"},{value:"name",label:"Nom A–Z"},{value:"members",label:"Entreprises"}];
const ownershipOptions=[{value:"all",label:"Tous"},{value:"owned",label:"Détenus uniquement"}];

function BasketChart({series,name,period}:{series:NonNullable<ThemeBasketResponse["selectedBasket"]>["series"];name:string;period:BasketPeriod}){
  const [activeIndex,setActiveIndex]=useState<number|null>(null);
  const svgRef=useRef<SVGSVGElement>(null);
  if(series.length<2)return <div className="theme-basket-chart-empty">Historique insuffisant pour tracer cette période.</div>;
  const left=14,right=99,top=4,bottom=40;
  const returns=series.map(point=>point.value-100);
  const timestamps=series.map(point=>Date.parse(`${point.date}T12:00:00Z`));
  const firstTime=timestamps[0],timeSpan=Math.max(1,timestamps.at(-1)!-firstTime);
  const min=Math.min(0,...returns),max=Math.max(0,...returns),spread=max-min||1,padding=spread*.08;
  const minValue=min===0&&max===0?-1:Math.min(0,min-padding),maxValue=min===0&&max===0?1:Math.max(0,max+padding);
  const pointX=(index:number)=>left+(timestamps[index]-firstTime)/timeSpan*(right-left);
  const pointY=(value:number)=>bottom-(value-minValue)/(maxValue-minValue)*(bottom-top);
  const points=series.map((point,index)=>({x:pointX(index),y:pointY(point.value-100),value:point.value-100}));
  const path=points.map((point,index)=>`${index===0?"M":"L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const zeroY=pointY(0);
  const areas=(positive:boolean)=>points.slice(1).flatMap((point,index)=>{
    const previous=points[index],abovePrevious=previous.value>=0,abovePoint=point.value>=0;
    if(abovePrevious===abovePoint){if(abovePrevious!==positive)return [];return [`M ${previous.x} ${zeroY} L ${previous.x} ${previous.y} L ${point.x} ${point.y} L ${point.x} ${zeroY} Z`];}
    const crossX=previous.x+(point.x-previous.x)*(-previous.value)/(point.value-previous.value);
    const cross=`${crossX} ${zeroY}`;
    return positive
      ? abovePrevious?[`M ${previous.x} ${zeroY} L ${previous.x} ${previous.y} L ${cross} Z`]:[`M ${cross} L ${point.x} ${point.y} L ${point.x} ${zeroY} Z`]
      : abovePrevious?[`M ${cross} L ${point.x} ${point.y} L ${point.x} ${zeroY} Z`]:[`M ${previous.x} ${zeroY} L ${previous.x} ${previous.y} L ${cross} Z`];
  }).join(" ");
  const ticks=minValue<0&&maxValue>0?[maxValue,0,minValue]:maxValue>0?[maxValue,maxValue/2,0]:[0,minValue/2,minValue];
  const middleTime=firstTime+timeSpan/2;
  const middleIndex=timestamps.reduce((closest,timestamp,index)=>Math.abs(timestamp-middleTime)<Math.abs(timestamps[closest]-middleTime)?index:closest,0);
  const dates=[...new Set([0,middleIndex,series.length-1])];
  const formatDate=(date:string,year=false)=>new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR",{day:"numeric",month:"short",...(year?{year:"numeric"}:{}),timeZone:"UTC"});
  const active=activeIndex===null?null:series[Math.min(activeIndex,series.length-1)];
  const indexAt=(clientX:number)=>{
    const rect=svgRef.current?.getBoundingClientRect();
    if(!rect||!rect.width)return;
    const plotRatio=((clientX-rect.left)/rect.width-left/100)/((right-left)/100);
    const target=left+Math.min(1,Math.max(0,plotRatio))*(right-left);
    setActiveIndex(points.reduce((closest,point,index)=>Math.abs(point.x-target)<Math.abs(points[closest].x-target)?index:closest,0));
  };
  const moveSelection=(direction:number)=>setActiveIndex(current=>current===null?(direction>0?0:series.length-1):Math.min(series.length-1,Math.max(0,current+direction)));
  return <figure className="theme-basket-chart">
    <div className="theme-basket-chart-plot">
    <svg ref={svgRef} viewBox="0 0 100 52" preserveAspectRatio="none" role="group" tabIndex={0} aria-label={`Courbe interactive du panier ${name}, ${periodLabels[period]}. Faites glisser le doigt ou utilisez les flèches gauche et droite pour lire une date et sa performance.`}
      onFocus={()=>{if(activeIndex===null)setActiveIndex(0);}}
      onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);indexAt(event.clientX);}}
      onPointerMove={event=>{if(event.pointerType==="mouse"||event.buttons>0||event.pointerType==="touch")indexAt(event.clientX);}}
      onKeyDown={event=>{if(event.key==="ArrowLeft"){event.preventDefault();moveSelection(-1);}else if(event.key==="ArrowRight"){event.preventDefault();moveSelection(1);}else if(event.key==="Home"){event.preventDefault();setActiveIndex(0);}else if(event.key==="End"){event.preventDefault();setActiveIndex(series.length-1);}}}>
      {ticks.map((tick,index)=><g className="theme-basket-chart-axis" key={`y-${index}`}><line x1={left} x2={right} y1={pointY(tick)} y2={pointY(tick)}/><text x="0" y={pointY(tick)+1}>{tick===0?"0":new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(tick)} %</text></g>)}
      {dates.map(index=><text className="theme-basket-chart-date" key={series[index].date} x={pointX(index)} y="49" textAnchor={index===0?"start":index===series.length-1?"end":"middle"}>{formatDate(series[index].date,index===0||index===series.length-1)}</text>)}
      <line className="theme-basket-chart-zero" x1={left} x2={right} y1={zeroY} y2={zeroY}/>
      <path className="theme-basket-chart-area-positive" d={areas(true)}/><path className="theme-basket-chart-area-negative" d={areas(false)}/>
      <rect className="theme-basket-chart-hit-area" x={left} y={top} width={right-left} height={bottom-top}/>
      <path className="theme-basket-chart-line" d={path}/>
      {active&&<><path className="theme-basket-chart-cursor" d={`M ${pointX(activeIndex!)} ${top} V ${bottom}`}/><circle className="theme-basket-chart-point" cx={pointX(activeIndex!)} cy={pointY(active.value-100)} r="1.45"/></>}
    </svg>
    {active&&<output className="theme-basket-chart-tooltip" data-placement={pointY(active.value-100)<12?"below":"above"} style={{left:`clamp(4.5rem, ${pointX(activeIndex!)}%, calc(100% - 4.5rem))`,top:`${pointY(active.value-100)/52*100}%`}}><time dateTime={active.date}>{formatDate(active.date,true)}</time><strong className={active.value>100?"is-positive":active.value<100?"is-negative":"is-neutral"}>{percent(active.value-100)}</strong></output>}
    </div>
    <output className="theme-basket-chart-reading" aria-live="polite">{active?`${formatDate(active.date,true)} · ${percent(active.value-100)}`:`Courbe interactive : ${name}, ${periodLabels[period]}. Utilisez le toucher ou les flèches pour lire une date et sa performance.`}</output>
  </figure>;
}

export function ThemeBaskets({openCompany=()=>undefined,initialData}:{openCompany?:(companyId:string)=>void;initialData?:ThemeBasketResponse}){
  const [dimension,setDimension]=useState<BasketDimension>(initialData?.dimension??"theme");
  const [period,setPeriod]=useState<BasketPeriod>(initialData?.period??"1y");
  const [selectedName,setSelectedName]=useState<string>(initialData?.selectedBasket?.name??"");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState("return");
  const [ownershipFilter,setOwnershipFilter]=useState("all");
  const query=new URLSearchParams({dimension,period});
  if(selectedName)query.set("basket",selectedName);
  const url=`/api/theme-baskets?${query.toString()}`;
  const {data,error,loading,refresh,updatedAt}=useClientResource<ThemeBasketResponse>(url,true,initialData===undefined);
  const [polledView,setPolledView]=useState<{url:string;data:ThemeBasketResponse;receivedAt:number}|null>(null);
  const pageRef=useRef<HTMLElement>(null);
  const autoRefreshStarted=useRef(false);
  const lastRefreshAt=useRef(0);
  const view=polledView?.url===url&&polledView.receivedAt>updatedAt?polledView.data:data??polledView?.data??initialData;
  useEffect(()=>{
    if(!loading||!view)return;
    let cancelled=false,inFlight=false;
    const readUpdatedCache=async()=>{
      if(inFlight||document.visibilityState!=="visible"||!pageRef.current?.getClientRects().length)return;
      inFlight=true;
      try{
        const response=await fetch(`${url}&snapshot=1`,{cache:"no-store"});
        if(response.ok){const snapshot=await response.json() as ThemeBasketResponse;if(!cancelled)setPolledView({url,data:snapshot,receivedAt:Date.now()});}
      }catch{/* The displayed snapshot remains available while offline. */}
      finally{inFlight=false;}
    };
    const interval=window.setInterval(()=>void readUpdatedCache(),2500);
    return()=>{cancelled=true;window.clearInterval(interval);};
  },[loading,url,view]);
  useEffect(()=>{if(view&&!autoRefreshStarted.current){autoRefreshStarted.current=true;lastRefreshAt.current=Date.now();void refresh();}},[view,refresh]);
  useEffect(()=>{
    const refreshIfDue=()=>{
      if(document.visibilityState!=="visible"||!pageRef.current?.getClientRects().length||!view||loading||Date.now()-lastRefreshAt.current<45*60*1000)return;
      lastRefreshAt.current=Date.now();
      void refresh();
    };
    const interval=window.setInterval(refreshIfDue,45*60*1000);
    window.addEventListener("focus",refreshIfDue);
    document.addEventListener("visibilitychange",refreshIfDue);
    return()=>{window.clearInterval(interval);window.removeEventListener("focus",refreshIfDue);document.removeEventListener("visibilitychange",refreshIfDue);};
  },[loading,refresh,view]);
  const requestedBasketName=selectedName||view?.selectedBasket?.name||"";
  const selected=view?.selectedBasket?.name===requestedBasketName?view.selectedBasket:null;
  const selectedSummary=view?.baskets.find(basket=>basket.name===requestedBasketName);
  const detailReturn=selected?.returnPercent??selectedSummary?.returnPercent??null;
  const searchTerm=search.trim().toLocaleLowerCase("fr-FR");
  const baskets=(view?.baskets??[])
    .filter(basket=>(!searchTerm||`${basket.name} ${basket.searchText}`.toLocaleLowerCase("fr-FR").includes(searchTerm))&&(ownershipFilter!=="owned"||basket.ownedCount>0))
    .sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"fr"):sort==="members"?b.memberCount-a.memberCount||a.name.localeCompare(b.name,"fr"):(b.returnPercent??-Infinity)-(a.returnPercent??-Infinity));

  return <section ref={pageRef} className="theme-basket-page" aria-label="Performance des paniers d’entreprises">
    <div className="theme-basket-controls">
      <CompactControl variant="select" ariaLabel="Regrouper les paniers par" value={dimension} options={dimensionOptions} onChange={value=>{setDimension(value as BasketDimension);setSelectedName("");}}/>
      <CompactControl variant="select" ariaLabel="Période de performance" value={period} options={periodOptions} onChange={value=>setPeriod(value as BasketPeriod)}/>
      <ActionButton compact onClick={()=>{lastRefreshAt.current=Date.now();void refresh(true);}} disabled={loading} ariaLabel="Actualiser les cours des paniers">Actualiser</ActionButton>
    </div>
    {error&&view&&<p className="resource-error" role="status">{error} Les dernières données chargées restent affichées.</p>}
    {view&&view.refreshErrors.length>0&&<p className="resource-error" role="status">Actualisation partielle : {view.refreshErrors.length} cours indisponible{view.refreshErrors.length>1?"s":""}. Les performances affichées utilisent les historiques disponibles.</p>}
    {!view&&loading?<AsyncState title="Chargement des paniers…" description="Lecture des cours historiques en cache." className="theme-basket-state"/>:null}
    {!view&&error?<AsyncState title="Paniers indisponibles" description={error} className="theme-basket-state"/>:null}
    {view&&view.baskets.length===0?<AsyncState title="Aucun panier disponible" description="Les sociétés doivent avoir un ticker et une classification pour apparaître." className="theme-basket-state"/>:null}
    {view&&view.baskets.length>0&&<>
      <PrimaryBlock as="section" className="theme-basket-directory" aria-label={dimension==="theme"?"Répertoire des paniers par thème":"Répertoire des paniers par secteur"}>
        <header className="theme-basket-directory-head"><h2>Répertoire des paniers</h2><span>{loading?"Mise à jour · ":""}{baskets.length} / {view.baskets.length}</span></header>
        <SearchField value={search} onChange={setSearch} placeholder="Panier, entreprise ou ticker…" ariaLabel="Rechercher un panier ou une entreprise"/>
        <div className="theme-basket-directory-controls">
          <CompactControl variant="select" ariaLabel="Trier les paniers" value={sort} options={sortOptions} onChange={setSort}/>
          <CompactControl variant="select" ariaLabel="Filtrer les paniers selon les sociétés détenues" value={ownershipFilter} options={ownershipOptions} onChange={setOwnershipFilter}/>
        </div>
        <div className="theme-basket-list-scroll">
          <div className="theme-basket-list" aria-label={dimension==="theme"?"Paniers par thème":"Paniers par secteur"}>
            {baskets.map(basket=><button type="button" key={basket.name} className={`theme-basket-item${requestedBasketName===basket.name?" is-selected":""}`} aria-pressed={requestedBasketName===basket.name} onClick={()=>{if(requestedBasketName!==basket.name)setSelectedName(basket.name);}}>
              <span className="theme-basket-item-copy"><strong>{basket.name}</strong><small>{basket.memberCount} entreprise{basket.memberCount>1?"s":""} · {basket.ownedCount} détenue{basket.ownedCount>1?"s":""} · historiques {basket.coveredCount}/{basket.memberCount}</small></span>
              <strong className={`theme-basket-return${basket.returnPercent==null?" is-neutral":basket.returnPercent>=0?" is-positive":" is-negative"}`}>{percent(basket.returnPercent)}</strong>
            </button>)}
            {!baskets.length&&<p className="theme-basket-no-results">Aucun panier ne correspond à ces critères.</p>}
          </div>
        </div>
      </PrimaryBlock>
      {requestedBasketName?<PrimaryBlock as="section" className="theme-basket-detail" aria-label={`Panier ${requestedBasketName}`}>
        <header className="theme-basket-detail-head"><div><p className="eyebrow">Panier {dimension==="theme"?"thématique":"sectoriel"}</p><h2>{requestedBasketName}</h2><small>Au {selected?.endDate??selectedSummary?.endDate??"—"} · période depuis le {selected?.startDate??selectedSummary?.startDate??"—"} · clôtures locales · historique {selected?.coveredCount??selectedSummary?.coveredCount??0}/{selected?.memberCount??selectedSummary?.memberCount??0}</small></div><strong className={`theme-basket-detail-return${detailReturn==null?" is-neutral":detailReturn>=0?" is-positive":" is-negative"}`}>{percent(detailReturn)}</strong></header>
        {selected?<>
        <div className="theme-basket-metrics" aria-label="Résumé du panier">
          <div><strong>{selected.memberCount}</strong><span>Entreprises</span></div>
          <div><strong>{selected.ownedCount}</strong><span>Détenues</span></div>
          <div><strong>{selected.coveredCount}/{selected.memberCount}</strong><span>Historique disponible</span></div>
        </div>
        <BasketChart series={selected.series} name={selected.name} period={period}/>
        <div className="theme-basket-members">{selected.companies.map(company=><article className="theme-basket-member" key={company.id}>
          <button type="button" className="theme-basket-company" onClick={()=>openCompany(company.id)}><strong>{company.name}</strong><small>{company.ticker||"Sans ticker"}</small></button>
          <span>{company.ownershipStatus==="Owned"?<Badge tone="positive">Détenue</Badge>:null}</span>
          <strong className={`theme-basket-member-return${company.returnPercent==null?" is-neutral":company.returnPercent>=0?" is-positive":" is-negative"}`}>{percent(company.returnPercent)}</strong>
        </article>)}</div>
        </>:<p className="theme-basket-loading" role="status" aria-live="polite">{error|| (loading?"Chargement de la courbe et des entreprises…":"Les données détaillées de ce panier sont indisponibles.")}</p>}
      </PrimaryBlock>:<AsyncState title="Choisir un panier" description="Sélectionnez un thème ou un secteur pour voir son historique et ses entreprises." className="theme-basket-state"/>}
      {view.refreshErrors.length>0&&<p className="resource-error" role="status">Certains cours n’ont pas pu être actualisés : {view.refreshErrors.slice(0,3).join(" · ")}</p>}
    </>}
  </section>;
}
