"use client";

import { useState } from "react";
import { useClientResource } from "../lib/client-resource";
import { basketPeriods, type BasketDimension, type BasketPeriod, type ThemeBasketResponse } from "../lib/theme-baskets";
import { ActionButton, AsyncState, Badge, CompactControl, PrimaryBlock } from "./ui-primitives";

const periodLabels:Record<BasketPeriod,string>={"1d":"1D","5d":"5D","1m":"1M","6m":"6M",YTD:"YTD","1y":"1Y","5y":"5Y",max:"MAX"};
const percent=(value:number|null)=>value==null?"—":`${value>0?"+":""}${new Intl.NumberFormat("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1}).format(value)} %`;
const dimensionOptions=[{value:"sector",label:"Secteurs"},{value:"theme",label:"Thèmes"}];
const periodOptions=basketPeriods.map(value=>({value,label:periodLabels[value]}));

function BasketChart({series,name,period}:{series:NonNullable<ThemeBasketResponse["selectedBasket"]>["series"];name:string;period:BasketPeriod}){
  if(series.length<2)return <div className="theme-basket-chart-empty">Historique insuffisant pour tracer cette période.</div>;
  const values=series.map(point=>point.value);
  const min=Math.min(...values),max=Math.max(...values),spread=max-min||1;
  const path=series.map((point,index)=>`${index===0?"M":"L"} ${(index/(series.length-1)*100).toFixed(2)} ${(32-(point.value-min)/spread*28).toFixed(2)}`).join(" ");
  return <figure className="theme-basket-chart"><svg viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label={`Évolution du panier ${name} sur ${periodLabels[period]}`}><path d={path}/></svg><figcaption><span>{series[0].date}</span><span>{series.at(-1)?.date}</span></figcaption></figure>;
}

export function ThemeBaskets({openCompany=()=>undefined,initialData}:{openCompany?:(companyId:string)=>void;initialData?:ThemeBasketResponse}){
  const [dimension,setDimension]=useState<BasketDimension>(initialData?.dimension??"theme");
  const [period,setPeriod]=useState<BasketPeriod>(initialData?.period??"1y");
  const [selectedName,setSelectedName]=useState<string>(initialData?.selectedBasket?.name??"");
  const query=new URLSearchParams({dimension,period});
  if(selectedName)query.set("basket",selectedName);
  const url=`/api/theme-baskets?${query.toString()}`;
  const {data,error,loading,refresh}=useClientResource<ThemeBasketResponse>(url,true,initialData===undefined);
  const view=data??initialData;
  const selected=view?.selectedBasket;

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
      <div className="theme-basket-list" aria-label={dimension==="theme"?"Paniers par thème":"Paniers par secteur"}>
        {view.baskets.map(basket=><button type="button" key={basket.name} className={`theme-basket-item${selectedName===basket.name?" is-selected":""}`} aria-pressed={selectedName===basket.name} onClick={()=>setSelectedName(basket.name)}>
          <span className="theme-basket-item-copy"><strong>{basket.name}</strong><small>{basket.memberCount} entreprise{basket.memberCount>1?"s":""} · {basket.ownedCount} détenue{basket.ownedCount>1?"s":""} · historiques {basket.coveredCount}/{basket.memberCount}</small></span>
          <strong className={`theme-basket-return${basket.returnPercent==null?" is-neutral":basket.returnPercent>=0?" is-positive":" is-negative"}`}>{percent(basket.returnPercent)}</strong>
        </button>)}
      </div>
      {selected?<PrimaryBlock as="section" className="theme-basket-detail" aria-label={`Panier ${selected.name}`}>
        <header className="theme-basket-detail-head"><div><p className="eyebrow">Panier {dimension==="theme"?"thématique":"sectoriel"}</p><h2>{selected.name}</h2><small>{selected.startDate??"—"} → {selected.endDate??"—"} · cours disponibles {selected.coveredCount}/{selected.memberCount}</small></div><strong className={`theme-basket-detail-return${selected.returnPercent==null?" is-neutral":selected.returnPercent>=0?" is-positive":" is-negative"}`}>{percent(selected.returnPercent)}</strong></header>
        <BasketChart series={selected.series} name={selected.name} period={period}/>
        <div className="theme-basket-members">{selected.companies.map(company=><article className="theme-basket-member" key={company.id}>
          <button type="button" className="theme-basket-company" onClick={()=>openCompany(company.id)}><strong>{company.name}</strong><small>{company.ticker||"Sans ticker"}</small></button>
          <span>{company.ownershipStatus==="Owned"?<Badge tone="positive">Détenue</Badge>:null}</span>
          <strong className={`theme-basket-member-return${company.returnPercent==null?" is-neutral":company.returnPercent>=0?" is-positive":" is-negative"}`}>{percent(company.returnPercent)}</strong>
        </article>)}</div>
      </PrimaryBlock>:<AsyncState title="Choisir un panier" description="Sélectionnez un thème ou un secteur pour voir son historique et ses entreprises." className="theme-basket-state"/>}
      {view.refreshErrors.length>0&&<p className="resource-error" role="status">Certains cours n’ont pas pu être actualisés : {view.refreshErrors.slice(0,3).join(" · ")}</p>}
    </>}
  </section>;
}
