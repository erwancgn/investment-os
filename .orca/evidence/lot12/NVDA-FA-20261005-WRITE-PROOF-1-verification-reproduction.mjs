import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const root='/tmp/lot12-site-source',e='/Users/ec/orca/workspaces/investment-os-stabilization/hawkfish/.orca/evidence/lot12',run='NVDA-FA-20261005-WRITE-PROOF-1';
const {fixture}=await import(root+'/tests/fixtures/notion-write-harness.mjs');const args=JSON.parse(await readFile(e+'/'+run+'-business-save-arguments.json','utf8'));
const props={Analysis:'title','Run ID':'rich_text',Company:'relation',Agent:'select',Status:'select','Analysis Date':'date','Source Freshness':'select',Score:'number',Verdict:'rich_text',Confidence:'select','Handoff Summary':'rich_text'};
const reports=[];
for(const defaultIcon of [false,true]){
 const f=await fixture();try{
  f.pages.set(args.input.companyIds[0],{...structuredClone(f.company),id:args.input.companyIds[0]});let observedIcon;
  const opts={...f.options,fetch:async(url,opt)=>{
   const pathname=new URL(url).pathname;if(opt.method==='GET'&&pathname.startsWith('/v1/data_sources/'))return Response.json({properties:Object.fromEntries(Object.entries(props).map(([k,type])=>[k,{type}]))});
   const response=await f.options.fetch(url,opt);
   if(defaultIcon&&opt.method==='GET'&&pathname.includes('/children')){const body=await response.json();for(const block of body.results??[])if(block.type==='callout'&&!block.callout.icon){block.callout.icon={type:'emoji',emoji:'💡'};observedIcon=block.callout.icon;}return Response.json(body);}
   return response;
  }};
  const service=f.api.createInvestmentService(f.db,opts);const result=await service.saveAnalysis(args.input);assert.equal(result.status,'ok');const receipt=result.data;
  const read=await service.getAnalysisById(receipt.analysisId);const journal=await f.db.prepare('SELECT phase,page_id FROM notion_analysis_writes').first();const indexed=await f.db.prepare("SELECT count(*) as n FROM notion_documents WHERE source_key='analyses'").first();
  assert.equal(receipt.status,defaultIcon?'partial':'persisted');assert.equal(receipt.persisted,!defaultIcon);assert.equal(Boolean(read.data),!defaultIcon);assert.equal(indexed.n,defaultIcon?0:1);
  if(defaultIcon){assert.equal(receipt.diagnostics[0].code,'persistence_verification_failed');assert.equal(journal.phase,'persisting');}
  reports.push({label:defaultIcon?'SIMULATED REST callout default icon':'CONTROL mock echo DTO',receipt,journal,analysisRows:indexed.n,mcpReadbackPresent:Boolean(read.data),observedIcon:observedIcon??null,providerCreates:f.creates});
 }finally{f.sql.close();}
}
const report={networkCalls:0,productionChanges:0,exactArchivedPayload:true,productionAttribution:'Not proven from raw REST: archived live Notion connector renders 💡, but historical writer GET response was not recorded.',reports};await writeFile(e+'/'+run+'-verification-reproduction.json',JSON.stringify(report,null,2));await writeFile(e+'/'+run+'-verification-reproduction.mjs',await readFile('/tmp/lot12-proof1-verification-reproduction.mjs'));console.log(JSON.stringify(report,null,2));
