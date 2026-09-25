"use client";

import { useState } from "react";
import type { LivePortfolio, LiveTargetLine } from "../lib/investment-data";
import { PrimaryBlock, ProgressBar, SecondaryBlock, SegmentedControl } from "./ui-primitives";

const eur0 = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});

export function TargetAllocation({ data }: { data: LivePortfolio | null }){
  const [trajectory,setTrajectory]=useState<10|25>(25);
  const [targetValueDisplay,setTargetValueDisplay]=useState<"weight"|"amount">("weight");
  const isDemo = Boolean(data && (data.positions.some(position=>position.id.startsWith("demo-")) || data.targetLines.some(line=>line.id.startsWith("demo-"))));
  const targetValue=trajectory*1000;
  const currentValue=data?.totals?.marketValueEur??null;
  const progress=currentValue==null?null:Math.min(100,Math.max(0,currentValue/targetValue*100));
  const remaining=currentValue==null?null:Math.max(0,targetValue-currentValue);
  const currentByTarget=new Map<string,{name:string;value:number;unavailable:boolean}>();
  for(const position of data?.positions??[]){
    const current=currentByTarget.get(position.targetId)??{name:position.name,value:0,unavailable:false};
    currentByTarget.set(position.targetId,{name:current.name,value:current.value+(position.marketValueEur??0),unavailable:current.unavailable||position.marketValueEur==null});
  }
  const linesById=new Map<string,LiveTargetLine>((data?.targetLines??[]).map(line=>[line.id,line]));
  for(const [id,current] of currentByTarget){
    if(!linesById.has(id))linesById.set(id,{id,name:current.name,target10kWeight:0,target10kEur:0,target25kWeight:0,target25kEur:0});
  }
  const lines=[...linesById.values()].map(line=>{
    const weight=trajectory===25?line.target25kWeight:line.target10kWeight;
    const amount=trajectory===25?line.target25kEur:line.target10kEur;
    const current=currentByTarget.get(line.id);
    const currentAmount=data==null||current?.unavailable?null:current?.value??0;
    return {line,weight,amount,currentAmount};
  }).filter(item=>item.weight>0||(item.currentAmount??0)>0).sort((a,b)=>b.weight-a.weight||((b.currentAmount??0)-(a.currentAmount??0)));
  const total=trajectory===25?data?.targetTotals.target25kWeight:data?.targetTotals.target10kWeight;
  const coherent=total!=null&&Math.abs(total-100)<.001;
  const totalLabel=total==null?"Cible indisponible":coherent?`${total.toFixed(total%1?1:0)}%`:`Cible incomplète · ${total.toFixed(total%1?1:0)}%`;
  return <PrimaryBlock as="section" className="target-allocation">
    <div className="panel-head"><div><p className="eyebrow">{isDemo?"Objectif fictif · démonstration":"Cible issue de Notion Portfolio"}</p><h2>{trajectory===25?"Destination structurelle 25 000 €":"Cible 10 000 €"}</h2></div><div className="trajectory-switch"><SegmentedControl options={[{value:"25",label:"25k"},{value:"10",label:"10k"}]} value={String(trajectory) as "10"|"25"} onChange={value=>setTrajectory(Number(value) as 10|25)} ariaLabel="Choisir la trajectoire"/><span className={`target-total ${total!=null&&!coherent?"target-total-warning":""}`}>{totalLabel}</span></div></div>
    <SecondaryBlock className="trajectory-progress"><ProgressBar value={progress} tone="accent" label="Progression vers la cible"/><div><span>{progress==null?"Calcul en cours…":`${progress.toFixed(1)}% du chemin`}</span><span>{remaining==null?"Actualisation des cours en cours…":`${eur0.format(remaining)} restants via apports + performance`}</span></div></SecondaryBlock>
    <p className="target-policy">{trajectory===25?"Piloter la destination des prochains 1 000 €, selon la valorisation. Les légers dépassements intermédiaires ne déclenchent pas de vente.":"Ancienne cible conservée comme point de passage et historique de décision."}</p>
    <div className="target-list" role="list" aria-label="Répartition de la destination structurelle">{lines.map(({line,weight,amount,currentAmount})=>{
      const outsideTarget=amount<=0&&(currentAmount??0)>0;
      const completion=currentAmount==null||amount<=0?null:currentAmount/amount*100;
      const visualCompletion=completion==null?null:Math.min(100,Math.max(0,completion));
      const surplus=currentAmount==null?0:currentAmount-amount;
      const materiallyOver=completion!=null&&completion>110&&surplus>targetValue*.005;
      const reached=completion!=null&&completion>=100;
      const tone=currentAmount==null?"neutral":materiallyOver?"warning":reached?"positive":"accent";
      const label=currentAmount==null
        ? `${line.name} : cours indisponible`
        : outsideTarget
          ? `${line.name} : Hors cible`
          : `${line.name} : ${eur0.format(currentAmount)} sur ${eur0.format(amount)}, ${completion?.toFixed(1)} %`;
      const outsideWeight=currentAmount==null||data?.totals.marketValueEur==null||data.totals.marketValueEur<=0?null:currentAmount/data.totals.marketValueEur*100;
      const completionLabel=outsideTarget
        ? `${outsideWeight==null?"—":`${outsideWeight.toFixed(1)}%`} · Hors cible`
        : completion==null?"Cours indisponible":`${completion.toFixed(1)}%`;
      return <div role="listitem" key={line.id} className="allocation-row target-row">
        <div className="asset-name"><div><div className="target-row-heading"><strong>{line.name}</strong><small>{completionLabel}</small></div><ProgressBar value={visualCompletion} tone={tone} className="target-progress-bar" label={label}/></div></div>
        <button
          type="button"
          className="target-value-toggle"
          aria-label={`Afficher ${targetValueDisplay==="weight"?"le montant":"le poids"} cible de ${line.name}`}
          title="Basculer entre le poids et le montant cible"
          onClick={()=>setTargetValueDisplay(mode=>mode==="weight"?"amount":"weight")}
        >
          <strong>{targetValueDisplay==="weight"?`${weight}%`:eur0.format(amount)}</strong>
          <small>{targetValueDisplay==="weight"?"Poids cible":"Montant cible"}</small>
        </button>
      </div>;
    })}</div>
  </PrimaryBlock>;
}
