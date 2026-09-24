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
  const values=series.map(point=>point.value);
  const min=Math.min(...values),max=Math.max(...values),spread=max-min||1;
  const pointX=(index:number)=>index/(series.length-1)*100;
  const pointY=(value:number)=>32-(value-min)/spread*28;
  const path=series.map((point,index)=>`${index===0?"M":"L"} ${pointX(index).toFixed(2)} ${pointY(point.value).toFixed(2)}`).join(" ");
  const active=activeIndex===null?null:series[Math.min(activeIndex,series.length-1)];
  const indexAt=(clientX:number)=>{
    const rect=svgRef.current?.getBoundingClientRect();
    if(!rect||!rect.width)return;
    setActiveIndex(Math.round(Math.min(1,Math.max(0,(clientX-rect.left)/rect.width))*(series.length-1)));
  };
  const moveSelection=(direction:number)=>setActiveIndex(current=>current===null?(direction>0?0:series.length-1):Math.min(series.length-1,Math.max(0,current+direction)));
  return <figure className="theme-basket-chart">
    <svg ref={svgRef} viewBox="0 0 100 36" preserveAspectRatio="none" role="group" tabIndex={0} aria-label={`Courbe interactive du panier ${name}, ${periodLabels[period]}. Faites glisser le doigt ou utilisez les flèches gauche et droite pour lire une date et sa performance.`}
      onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);indexAt(event.clientX);}}
      onPointerMove={event=>{if(event.pointerType==="mouse"||event.buttons>0||event.pointerType==="touch")indexAt(event.clientX);}}
      onKeyDown={event=>{if(event.key==="ArrowLeft"){event.preventDefault();moveSelection(-1);}else if(event.key==="ArrowRight"){event.preventDefault();moveSelection(1);}else if(event.key==="Home"){event.preventDefault();setActiveIndex(0);}else if(event.key==="End"){event.preventDefault();setActiveIndex(series.length-1);}}}>
      <rect className="theme-basket-chart-hit-area" x="0" y="0" width="100" height="36"/>
      <path className="theme-basket-chart-line" d={path}/>
      {active&&<><path className="theme-basket-chart-cursor" d={`M ${pointX(activeIndex!)} 2 V 34`}/><circle className="theme-basket-chart-point" cx={pointX(activeIndex!)} cy={pointY(active.value)} r="1.6"/></>}
    </svg>
    <div className="theme-basket-chart-reading" aria-live="polite">
      {active?<><time dateTime={active.date}>{new Date(`${active.date}T12:00:00Z`).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"})}</time><strong className={active.value>100?"is-positive":active.value<100?"is-negative":"is-neutral"}>{percent(active.value-100)}</strong><span>depuis le début de la période</span></>:<span>Faites glisser le doigt sur la courbe pour lire la performance à une date donnée.</span>}
    </div>
    <figcaption><span>{series[0].date}</span><span>{series.at(-1)?.date}</span></figcaption>
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
  const {data,error,loading,refresh}=useClientResource<ThemeBasketResponse>(url,true,initialData===undefined);
  const [retainedView,setRetainedView]=useState(initialData);
  useEffect(()=>{if(data)setRetainedView(data);},[data]);
  const view=data??retainedView??initialData;
  const requestedBasketName=selectedName||view?.selectedBasket?.name||"";
  const selected=view?.selectedBasket?.name===requestedBasketName?view.selectedBasket:null;
  const selectedSummary=view?.baskets.find(basket=>basket.name===requestedBasketName);
  const detailReturn=selected?.returnPercent??selectedSummary?.returnPercent??null;
  const searchTerm=search.trim().toLocaleLowerCase("fr-FR");
  const baskets=(view?.baskets??[])
    .filter(basket=>(!searchTerm||`${basket.name} ${basket.searchText}`.toLocaleLowerCase("fr-FR").includes(searchTerm))&&(ownershipFilter!=="owned"||basket.ownedCount>0))
    .sort((a,b)=>sort==="name"?a.name.localeCompare(b.name,"fr"):sort==="members"?b.memberCount-a.memberCount||a.name.localeCompare(b.name,"fr"):(b.returnPercent??-Infinity)-(a.returnPercent??-Infinity));

  return <section className="theme-basket-page" aria-label="Performance des paniers d’entreprises">
    <div className="theme-basket-controls">
      <CompactControl variant="select" ariaLabel="Regrouper les paniers par" value={dimension} options={dimensionOptions} onChange={value=>{setDimension(value as BasketDimension);setSelectedName("");}}/>
      <CompactControl variant="select" ariaLabel="Période de performance" value={period} options={periodOptions} onChange={value=>setPeriod(value as BasketPeriod)}/>
      <ActionButton compact onClick={()=>void refresh()} disabled={loading} ariaLabel="Actualiser les cours des paniers">Actualiser</ActionButton>
    </div>
    {error&&view&&<p className="resource-error" role="status">{error} Les dernières données chargées restent affichées.</p>}
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
        <header className="theme-basket-detail-head"><div><p className="eyebrow">Panier {dimension==="theme"?"thématique":"sectoriel"}</p><h2>{requestedBasketName}</h2><small>{selected?.startDate??selectedSummary?.startDate??"—"} → {selected?.endDate??selectedSummary?.endDate??"—"}</small></div><strong className={`theme-basket-detail-return${detailReturn==null?" is-neutral":detailReturn>=0?" is-positive":" is-negative"}`}>{percent(detailReturn)}</strong></header>
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
