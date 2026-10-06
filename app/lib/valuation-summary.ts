import { plainInlineText } from "./inline-segments.ts";
import type { RenderBlock } from "./notion-renderer";

export type ValuationPresentation = {
  version: 2;
  scenarios: { name: "Bear" | "Base" | "Bull"; terminal?: string; terminalLabel?: string; cagr?: string; sourceBlockIndexes: number[] }[];
  horizon: string | null;
  referencePrice: string | null;
  referenceDate: string | null;
  thresholds: { rate: string; price: string; sourceBlockIndexes: number[] }[];
  promotedBlockIndexes: number[];
};
const names = ["Bear", "Base", "Bull"] as const;
const currencyPattern = /\b(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD)\b|[$€£¥]/i;
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function scenarioName(value: string): typeof names[number] | null {
  const s = normalized(value.trim());
  if (/^(bear|baissier|prudent)$/.test(s)) return "Bear";
  if (/^(base|central)$/.test(s)) return "Base";
  if (/^(bull|haussier|favorable)$/.test(s)) return "Bull";
  return null;
}
function cleanCells(row: string[]) { return row.map(s => plainInlineText(s).trim()); }
function money(value: string, fallback?: string) {
  const m = value.match(/(?:[~≈≃]\s*)?(?:\d[\d .,'’]*(?:[,.]\d+)?\s*(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥])|[$€£¥]\s*\d[\d .,'’]*(?:[,.]\d+)?)/i);
  const raw = m ?? (fallback ? value.match(/^\s*(?:[~≈≃]\s*)?\d[\d .,'’]*(?:[,.]\d+)?\s*$/) : null);
  if (!raw) return null;
  const c = raw[0].match(currencyPattern)?.[0] ?? fallback;
  return c ? (currencyPattern.test(raw[0]) ? raw[0].trim() : `${raw[0].trim()} ${c.toUpperCase()}`) : null;
}
function cagr(value: string) { return /[-−+]?\s*\d[\d,.]*\s*%/.test(value) ? (value.match(/[-−+]?\s*\d[\d,.]*\s*%/)?.[0].trim() ?? null) : null; }
function terminalLabel(s: string) { return /terminal price|target price|cours terminal|prix terminal|cours cible|prix cible|cible 20\d\d|prix objectif|valeur (?:totale|20\d\d|terminale)/i.test(s); }
function cagrLabel(s: string) { return !/\b(?:ebit|ebitda|eps|bpa|ca|revenue|sales|marge|margins?|chiffre d'affaires|free cash flow|fcf)\b/i.test(s) && /cagr|annualized return|annualised return|return|rendement|taux annualis/i.test(s); }
function thresholdRates(text: string) { return [...new Set([...text.matchAll(/\b(10|12|15)\s*%/g)].map(match => `${match[1]} %`))]; }
function thresholdPriceTokens(text: string) {
  return [...text.matchAll(/([~≈≃]?\s*\d[\d .,'’]*(?:[,.]\d+)?\s*(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥])?)(?![\d.,]|\s*%)/gi)]
    .map(match => match[1].trim()).filter(value => /\d/.test(value));
}
function explicitRows(block: Extract<RenderBlock,{type:"table"}>, index: number, referenceCurrency?: string) {
  const rows = block.rows.map(cleanCells).filter(r => r.some(Boolean) && !r.filter(Boolean).every(cell => /^:?-{3,}:?$/.test(cell)));
  if (!rows.length) return { scenarios: [], full: false };
  const found: ValuationPresentation["scenarios"] = [];
  const header = rows[0];
  const scenarioCols = names.map(name => header.findIndex(cell => scenarioName(cell) === name));
  if (scenarioCols.every(i => i >= 0)) {
    const trow = rows.find(r => r.some(cell => terminalLabel(cell)));
    const crow = rows.find(r => cagrLabel(r[0] ?? ""));
    const currencies = new Set([...(trow ?? []).flatMap(v => v.match(currencyPattern) ?? [])].map(normalized));
    for (let i=0;i<3;i++) {
      const rowCurrency = trow?.find(cell => terminalLabel(cell))?.match(currencyPattern)?.[0] ?? (currencies.size===0?referenceCurrency:undefined);
      const terminal = trow && currencies.size <= 1 ? money(trow[scenarioCols[i]], rowCurrency) ?? undefined : undefined;
      const rate = crow ? cagr(crow[scenarioCols[i]] ?? "") ?? undefined : undefined;
      if (terminal || rate) found.push({name:names[i], ...(terminal?{terminal, terminalLabel: /dividendes|dividends/i.test(trow?.[0] ?? "") ? "Valeur à l’horizon, dividendes inclus" : "Prix terminal"}:{}), ...(rate?{cagr:rate}:{}), sourceBlockIndexes:[index]});
    }
    return {scenarios:found, full: !!trow && !!crow && found.length === 3 && currencies.size <= 1 && rows.length === 3};
  }
  const scenarioCol = header.findIndex(s => /scenario|scénario/i.test(s));
  const terminalCol = header.findIndex(terminalLabel);
  const cagrCol = header.findIndex(cagrLabel);
  if (scenarioCol >= 0 && (terminalCol >= 0 || cagrCol >= 0)) {
    const declaredCurrency = terminalCol >= 0 ? header[terminalCol].match(currencyPattern)?.[0] ?? referenceCurrency : undefined;
    const valueCurrencies = new Set(rows.slice(1).flatMap(row => terminalCol >= 0 ? (row[terminalCol]?.match(currencyPattern) ?? []) : []).map(normalized));
    const currencyConflict = valueCurrencies.size > 1 || (!!declaredCurrency && valueCurrencies.size > 0 && !valueCurrencies.has(normalized(declaredCurrency)));
    for (const row of rows.slice(1)) {
      const name = scenarioName(row[scenarioCol] ?? ""); if (!name) continue;
      const t = terminalCol >= 0 && !currencyConflict ? money(row[terminalCol] ?? "", declaredCurrency) : null;
      const r = cagrCol >= 0 ? cagr(row[cagrCol] ?? "") : null;
      if (t || r) found.push({name, ...(t?{terminal:t, terminalLabel: /dividendes|dividends/i.test(header[terminalCol] ?? "") ? "Valeur à l’horizon, dividendes inclus" : "Prix terminal"}:{}), ...(r?{cagr:r}:{}), sourceBlockIndexes:[index]});
    }
    return {scenarios:found, full: found.length === 3 && new Set(found.map(s=>s.name)).size === 3 && found.every(s=>s.terminal && s.cagr) && !currencyConflict && rows.length === 4 && rows.every(row => row.every((cell, column) => [scenarioCol, terminalCol, cagrCol].includes(column) || !cell))};
  }
  return {scenarios:[],full:false};
}
function referenceValues(blocks: RenderBlock[]) {
  const text = blocks.flatMap(b => b.type === "table" ? b.rows.flat() : b.type === "list" ? b.items : "text" in b ? [b.text] : []).map(plainInlineText).join(" · ");
  return {
    referencePrice: text.match(/(?:cours|prix)\s+(?:de\s+)?r[eé]f[eé]rence\s*[:：]\s*([\d][\d\s.,]*\s*(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥]))/i)?.[1]?.trim() ?? null,
    referenceDate: text.match(/(?:cl[oô]ture(?:\s+[A-Z]{2,6})?\s+(?:du\s+)?|(?:cours|prix)\s+(?:de\s+)?r[eé]f[eé]rence\s+du\s+)(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i)?.[1] ?? null,
  };
}
function thresholdExtraction(blocks: RenderBlock[]) {
  const thresholdHead = /prix\s+maximal|prix\s+pour\s+\d|hurdle|seuil/i;
  const output: ValuationPresentation["thresholds"] = []; const promoted: number[]=[];
  for (let i=0;i<blocks.length;i++) {
    const b=blocks[i];
    if (b.type === "heading" && thresholdHead.test(b.text)) {
      let end=i+1; while(end<blocks.length && blocks[end].type!=="heading") end++;
      const range=blocks.slice(i+1,end); const section=normalized([b.text,...range.flatMap(x=>x.type==="paragraph"?[x.text]:x.type==="list"?x.items:[])].join(" "));
      const qualified=/base intact|prix maximal|prix pour\s*10/.test(section);
      if (!qualified) continue;
      for (let j=i+1;j<end;j++) {
        const item=blocks[j];
        if(item.type==="table") {
          const rows=item.rows.map(cleanCells).filter(r=>r.some(Boolean) && !r.filter(Boolean).every(cell=>/^:?-{3,}:?$/.test(cell))); const h=rows[0]??[];
          const ri=h.findIndex(x=>/hurdle|rendement|objectif|exig|rate/i.test(x)); const pi=h.findIndex(x=>/prix|cours|price/i.test(x));
          if(ri<0||pi<0) continue;
          let all=true; const seenRates=new Set<string>();
          for(const row of rows.slice(1)) { const rate=row[ri]?.match(/\b(10|12|15)\s*%/)?.[1]; if(!rate) { all=false; continue; } seenRates.add(rate); const p=money(row[pi]??""); if(p) output.push({rate:`${rate} %`,price:p,sourceBlockIndexes:[j]}); else all=false; }
          if(all && seenRates.size===3 && rows.length===4) promoted.push(j);
        } else if(item.type==="paragraph"||item.type==="list") {
          const texts=item.type==="paragraph"?[item.text]:item.items;
          for(const text of texts) for(const m of text.matchAll(/(?:prix\s+maximal\s+(?:pour\s*)?|(?:hurdle\s*)?)(10|12|15)\s*%\s*(?:[:：]\s*)?([~≈≃]?\s*\d[\d .,'’]*(?:[,.]\d+)?\s*(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥]))/gi)) {
            const price=money(m[2].replace(/[.!?]+$/,""));
            if(price) output.push({rate:`${m[1]} %`,price,sourceBlockIndexes:[j]});
          }
        }
      }
      const declaredRates=thresholdRates([b.text,...range.flatMap(x=>x.type==="paragraph"?[x.text]:x.type==="list"?x.items:[])].join(" "));
      if(declaredRates.length) {
        for(let j=i+1;j<end;j++) {
          const item=blocks[j]; const texts=item.type==="paragraph"?[item.text]:item.type==="list"?item.items:[];
          for(const text of texts) {
            const values=thresholdPriceTokens(text);
            const units=new Set([...text.matchAll(/\b(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD)\b|[$€£¥]/gi)].map(match=>normalized(match[0])));
            if(values.length!==declaredRates.length || units.size!==1) continue;
            const groupApproximation=text.match(/[:：]\s*([~≈≃])/u)?.[1];
            values.forEach((value,index)=>{const price=money(groupApproximation && !/^[~≈≃]/u.test(value) ? `${groupApproximation}${value}` : value,units.values().next().value); if(price) output.push({rate:declaredRates[index],price,sourceBlockIndexes:[j]});});
          }
        }
      }
    }
  }
  const byRate=new Map<string,ValuationPresentation["thresholds"][number]>(); const conflicts=new Set<string>(); const conflictingSourceIndexes=new Set<number>();
  for(const t of output) { if(conflicts.has(t.rate)) continue; const old=byRate.get(t.rate); if(old && old.price!==t.price) { byRate.delete(t.rate); conflicts.add(t.rate); for(const index of [...old.sourceBlockIndexes,...t.sourceBlockIndexes]) conflictingSourceIndexes.add(index); } else if(!old) byRate.set(t.rate,t); }
  return {thresholds:[...byRate.values()],promoted:promoted.filter(index=>!conflictingSourceIndexes.has(index))};
}
/** Versioned app-side view of explicit valuation facts. Source text remains authoritative. */
export function extractValuationSummary(blocks: RenderBlock[]): ValuationPresentation | null {
  const scenarios: ValuationPresentation["scenarios"]=[]; const scenarioPromoted:number[]=[];
  // Use only an explicit reference-price/currency declaration, never a ticker
  // or locale. Conflicting declarations do not supply a fallback currency.
  const referenceCurrencies = new Set(blocks.flatMap(block=>block.type==="table"?block.rows.filter(row=>row.length===2&&/^(?:prix|cours) (?:de )?r[eé]f[eé]rence$|^devise(?: de r[eé]f[eé]rence)?$|^currency$/i.test(plainInlineText(row[0]).trim())).flatMap(row=>[...plainInlineText(row[1]).matchAll(/\b(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD)\b|[$€£¥]/gi)].map(match=>match[0].toUpperCase())):[]));
  const referenceCurrency = referenceCurrencies.size===1?[...referenceCurrencies][0]:undefined;
  for(let i=0;i<blocks.length;i++) {
    const b=blocks[i];
    if(b.type==="table") { const got=explicitRows(b,i,referenceCurrency); scenarios.push(...got.scenarios); if(got.full) scenarioPromoted.push(i); continue; }
    if(b.type==="paragraph") {
      const rx=/\b(bear|base|bull|baissier|central|haussier)\b\s*[:：]?\s*([\s\S]*?)(?=\b(?:bear|base|bull|baissier|central|haussier)\b|$)/gi;
      for(const m of plainInlineText(b.text).matchAll(rx)) {
        const name=scenarioName(m[1]);
        if(!name) continue;
        const segment=m[2].trim().replace(/[.;|!?]+$/, "").trim();
        const terminalLabelMatch=segment.match(/(?:cible|target price|cours terminal|prix terminal)\s*[:=]?\s*([~≈≃]?\s*\d[\d . ,'’]*(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥]))/i);
        const shareholderRate=segment.match(/(?:cagr\s+(?:actionnaire|(?:du\s+)?cours|total)|shareholder\s+cagr|shareholder return|stock return|rendement\s+(?:actionnaire|du cours|annualis[eé]))\s*[:=]?\s*([-−+]?\s*\d[\d,.]*\s*%)/i);
        const operatingCagr=/\b(?:cagr|rendement)\s+(?:ebit|ebitda|eps|bpa|ca|revenus?|chiffre d'affaires|marges?|fcf)\b/i.test(segment);
        const genericRate=!operatingCagr ? segment.match(/(?:cagr|annualized return|annualised return|return|rendement)\s*[:=]?\s*([-−+]?\s*\d[\d,.]*\s*%)/i) : null;
        const compactScenarioMetrics=segment.match(/^\s*[:：]?\s*([~≈≃]?\s*[-−+]?\s*\d[\d,.]*\s*(?:USD|EUR|GBP|CHF|CAD|JPY|SEK|TWD|[$€£¥]))\s*\/\s*([-−+]?\s*\d[\d,.]*\s*%)\s*$/i);
        const terminal=terminalLabelMatch?money(terminalLabelMatch[1]):compactScenarioMetrics?money(compactScenarioMetrics[1]):null;
        const rateMatch=shareholderRate??genericRate??compactScenarioMetrics;
        const rate=rateMatch?cagr(compactScenarioMetrics && rateMatch===compactScenarioMetrics ? compactScenarioMetrics[2] : rateMatch[1]):null;
        if(terminal||rate) scenarios.push({name,...(terminal?{terminal}:{}),...(rate?{cagr:rate}:{}),sourceBlockIndexes:[i]});
      }
    }
  }
  const ambiguousNames = new Set<string>(); const scenarioIndexesByName = new Map<string, Set<number>>();
  for(const item of scenarios) { const indexes=scenarioIndexesByName.get(item.name)??new Set<number>(); for(const sourceIndex of item.sourceBlockIndexes) indexes.add(sourceIndex); scenarioIndexesByName.set(item.name,indexes); }
  const scenariosUnique=names.flatMap(name=>{const matches=scenarios.filter(s=>s.name===name); if(!matches.length)return[]; const signatures=new Set(matches.map(s=>`${s.terminal??""}|${s.cagr??""}`)); if(signatures.size!==1) ambiguousNames.add(name); return signatures.size===1?[matches[0]]:[];});
  // A full table can be hidden only if none of its facts are contradicted elsewhere.
  const safeScenarioPromoted = scenarioPromoted.filter(index => ![...ambiguousNames].some(name => scenarioIndexesByName.get(name)?.has(index)));
  const th=thresholdExtraction(blocks); const reference=referenceValues(blocks);
  const horizon=blocks.some(b=>"text" in b&&/\b5\s*ans\b/i.test(b.text))||blocks.some(b=>b.type==="table"&&b.rows.some(r=>r.some(c=>/\b5\s*ans\b/i.test(c))))?"5 ans":null;
  const allPromoted=[...new Set([...safeScenarioPromoted,...th.promoted])].sort((a,b)=>a-b);
  if(!scenariosUnique.length&&!th.thresholds.length) return null;
  return {version:2,scenarios:scenariosUnique,horizon,...reference,thresholds:th.thresholds,promotedBlockIndexes:allPromoted};
}
