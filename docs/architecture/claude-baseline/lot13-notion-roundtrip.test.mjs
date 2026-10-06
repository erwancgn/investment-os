import test from 'node:test';
import assert from 'node:assert/strict';
import {withFixture,input} from './fixtures/notion-write-harness.mjs';
const text=value=>[{text:value,marks:[],href:null}];
const table=(id,rows)=>({id,sourceIds:['fixture-source'],type:'table',header:true,rows:rows.map(row=>row.map(text))});
const heading=(id,value)=>({id,sourceIds:['fixture-source'],type:'heading',level:2,text:text(value)});
const scenarios=table('scenarios',[['Hypothèse','Bear','Base','Bull'],['Prix terminal','189.32','329.07','518.33'],['CAGR hors distributions','-7.05%','3.82%','13.70%']]);
const removeIds=value=>Array.isArray(value)?value.map(removeIds):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['id','sourceIds'].includes(key)).map(([key,item])=>[key,removeIds(item)])):value;
const notionRichText=value=>Array.isArray(value)?value.map(notionRichText):value&&typeof value==='object'?{...Object.fromEntries(Object.entries(value).map(([key,item])=>[key,notionRichText(item)])),...(value.type==='text'&&value.text?.content?{plain_text:value.text.content}:{})}:value;
async function roundtrip(f,{declarations=[['Prix de référence','272.8 EUR']],unknownProperty=false}={}){
 const draft=input();draft.analysis.kind='valuation';draft.analysis.header.family='valuation';draft.analysis.header.agent='Valuation Analyst';draft.analysis.header.status='Draft';draft.analysis.header.sourceFreshness='unknown';draft.analysis.summary='Rapport provisoire avec scénarios explicites.';draft.analysis.verdict='Non concluante';draft.analysis.confidence='Low';
 draft.analysis.content.blocks=[heading('title','Valuation Check'),heading('card-heading','Valuation Card'),table('card',[['Valuation Card','Résultat'],...declarations,['Horizon','5 ans']]),heading('scenario-heading','Scénarios'),scenarios];
 const base=f.options.fetch;
 const service=f.api.createInvestmentService(f.db,{...f.options,fetch:async(url,opt)=>{
  const response=await base(url,opt);
  if(opt.method==='GET'&&new URL(url).pathname.startsWith('/v1/data_sources/')){
   const schema=await response.json();Object.assign(schema.properties,{Verdict:{type:'rich_text'},Confidence:{type:'select'},Score:{type:'number'}});return Response.json(schema);
  }
  if(opt.method==='GET'&&new URL(url).pathname.startsWith('/v1/blocks/'))return Response.json(notionRichText(await response.json()));
  return response;
 }});
 const saved=await service.saveAnalysis(draft);assert.equal(saved.status,'ok');assert.equal(saved.data.persisted,true);assert.equal(saved.data.promoted,false);
 if(unknownProperty){const page=f.pages.get(saved.data.analysisId);page.properties['Unmapped material fact']={type:'rich_text',rich_text:[{plain_text:'Historical evidence retained',text:{content:'Historical evidence retained'}}]};await f.db.batch([f.api.documentUpsertStatement(f.db,'analyses',page,f.blocks.get(saved.data.analysisId))]);}
 const read=await service.getAnalysisById(saved.data.analysisId);assert.equal(read.status,'ok');return {draft,actual:read.data};
}
test('native Notion roundtrip separates metadata from body and extracts card after writer summary',()=>withFixture({},async f=>{
 const {draft,actual}=await roundtrip(f);
 assert.equal(actual.header.status,'Draft');assert.equal(actual.header.archived,false);assert.equal(actual.verdict,draft.analysis.verdict);assert.equal(actual.confidence,'Low');
 assert.equal(actual.content.blocks.length,draft.analysis.content.blocks.length+3,JSON.stringify(actual.content.blocks.filter(b=>b.type==='unsupported')));
 assert.deepEqual(removeIds(actual.content.blocks.slice(3)),removeIds(draft.analysis.content.blocks));
 assert.ok(actual.presentation.facts.some(fact=>fact.label==='Prix de référence'&&fact.value==='272.8 EUR'));
 assert.deepEqual(actual.presentation.scenarios.map(s=>[s.label,s.terminalValue?.value,s.terminalValue?.unit]),[['Bear',189.32,'EUR'],['Base',329.07,'EUR'],['Bull',518.33,'EUR']]);
}));
for(const declarations of [[],[['Prix de référence','272.8 EUR'],['Devise','USD']]])test(`bare terminal prices are not assigned an invented currency (${declarations.length?'conflicting declarations':'no declaration'})`,()=>withFixture({},async f=>{
 const {actual}=await roundtrip(f,{declarations});assert.ok(actual.presentation.scenarios.every(s=>s.terminalValue===null));assert.equal(actual.presentation.scenarios.length,3);
}));
test('metadata separation retains an unmapped historical source fact',()=>withFixture({},async f=>{
 const {actual}=await roundtrip(f,{unknownProperty:true});assert.ok(actual.content.blocks.some(b=>b.type==='unsupported'&&b.sourceType==='unrepresented_snapshot'&&b.text.includes('Historical evidence retained')));
}));
