import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withFixture, input, compact, companyId, proposedId } from './fixtures/notion-write-harness.mjs';
function providerIconOptions(f,emoji){return {...f.options,fetch:async(url,options)=>{
 const response=await f.options.fetch(url,options);
 if(options.method==='GET'&&new URL(url).pathname.includes('/children')){
  const body=await response.json();for(const block of body.results??[])if(block.type==='callout')block.callout.icon={type:'emoji',emoji};
  return Response.json(body);
 }
 return response;
}};}
for(const [expected,observed,status] of [[null,'💡','Draft'],['🔥','🔥','Validated'],['🔥','💡','Draft']])test(`callout semantic verification ${expected} -> ${observed}`,()=>withFixture({},async f=>{
 const draft=input();draft.analysis.header.status=status;
 const callout={id:'icon-callout',sourceIds:['fixture-source'],type:'callout',text:[{text:'Canonical callout.',marks:[],href:null}],icon:expected};
 // Exercise prefix/append checks as well as persistence verification when no icon was requested.
 draft.analysis.content.blocks=expected===null?[callout,...Array.from({length:100},(_,i)=>({id:`p-${i}`,sourceIds:['fixture-source'],type:'paragraph',text:[{text:`Paragraph ${i}.`,marks:[],href:null}]}))]:[callout];
 const writer=f.api.createNotionAnalysisWriter(f.db,providerIconOptions(f,observed));
 const saved=await writer(draft);
 if(expected!==null&&expected!==observed){assert.equal(saved.status,'partial');assert.equal(saved.persisted,false);assert.equal(saved.diagnostics[0].code,'persistence_verification_failed');assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM notion_documents WHERE source_key='analyses'").get().n,0);}
 else {assert.equal(saved.status,status==='Draft'?'persisted':'verified');assert.equal(saved.persisted,true);assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM notion_documents WHERE source_key='analyses'").get().n,1);
  const replay=await writer(draft);assert.equal(replay.persisted,true);assert.equal(f.creates,1);
 }
}));
test('exact AN-598 payload with provider callout icon reaches persisted journal, D1 and immediate readback',()=>withFixture({},async f=>{
 const args=JSON.parse(await readFile(new URL('./fixtures/lot12-an598-business.json',import.meta.url),'utf8'));
 f.pages.set(args.input.companyIds[0],{...structuredClone(f.company),id:args.input.companyIds[0]});
 const props={Analysis:'title','Run ID':'rich_text',Company:'relation',Agent:'select',Status:'select','Analysis Date':'date','Source Freshness':'select',Score:'number',Verdict:'rich_text',Confidence:'select','Handoff Summary':'rich_text'};
 const options=providerIconOptions(f,'💡'),fetch=options.fetch;
 options.fetch=async(url,opt)=>opt.method==='GET'&&new URL(url).pathname.startsWith('/v1/data_sources/')?Response.json({properties:Object.fromEntries(Object.entries(props).map(([name,type])=>[name,{type}]))}):fetch(url,opt);
 const service=f.api.createInvestmentService(f.db,options);const result=await service.saveAnalysis(args.input);
 assert.equal(result.status,'ok');assert.equal(result.data.status,'persisted');assert.equal(result.data.persisted,true);assert.equal(result.data.promoted,false);assert.equal(result.data.verified,false);
 assert.equal(result.data.diagnostics.some(d=>d.code==='persistence_verification_failed'),false);
 assert.equal(f.sql.prepare('SELECT phase FROM notion_analysis_writes').get().phase,'persisted');
 assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM notion_documents WHERE source_key='analyses'").get().n,1);
 const read=await service.getAnalysisById(result.data.analysisId);assert.equal(read.status,'ok');assert.equal(read.data.header.id,result.data.analysisId);assert.equal(read.data.score,'92');assert.equal(read.data.verdict,'Excellent');
 assert.equal(f.creates,1);assert.equal(f.promotions,0);
}));
for(const icon of [null,'⭐'])test(`callout ${icon===null?'without icon omits icon entirely':'with emoji preserves the Notion icon DTO'}`,()=>withFixture({},async f=>{
 const draft=input();draft.analysis.header.status='Draft';draft.analysis.content.blocks=[{id:'callout-1',sourceIds:['fixture-source'],type:'callout',text:[{text:'Canonical callout.',marks:[],href:null}],icon}];
 const writer=f.api.createNotionAnalysisWriter(f.db,{...f.options,fetch:async(url,options)=>{
  if(options.method==='POST'&&new URL(url).pathname==='/v1/pages'){
   const callout=JSON.parse(options.body).children[0].callout;
   assert.notEqual(callout.icon,null,'icon:null must never reach Notion');
   if(icon===null)assert.equal(Object.hasOwn(callout,'icon'),false);
   else assert.deepEqual(callout.icon,{type:'emoji',emoji:icon});
  }
  return f.options.fetch(url,options);
 }});
 const saved=await writer(draft);assert.equal(saved.status,'persisted');assert.equal(f.creates,1);
 assert.equal(f.blocks.get(saved.analysisId)[0].callout.rich_text[0].text.content,'Canonical callout.');
}));
test('Notion rejection diagnostics retain structural validation paths without echoed payload or secrets',t=>withFixture({},async f=>{
 const logged=[];t.mock.method(console,'error',(...args)=>logged.push(args));
 const secret='sensitive_payload_value';let attempts=0;
 const writer=f.api.createNotionAnalysisWriter(f.db,{...f.options,fetch:async(url,options)=>{
  if(options.method==='POST'&&new URL(url).pathname==='/v1/pages'){attempts++;return Response.json({code:'validation_error',message:`body.children[6].callout.icon should be an object, instead was ${secret}.\nbody.properties.${secret}.title should be an array, instead was ${secret}.`,request_id:secret},{status:400});}
  return f.options.fetch(url,options);
 }});
 await assert.rejects(writer(input()),error=>{
  assert.equal(error.code,'invalid_input');assert.deepEqual(error.notionDiagnostic,{status:400,type:'unknown',code:'validation_error',validation:[{path:'body.children[6].callout.icon',expected:'object'},{path:'body.properties.redacted.title',expected:'array'}]});return true;
 });
 assert.equal(attempts,1);assert.equal(logged.length,1);assert.equal(logged[0][0],'notion_request_rejected');assert.equal(JSON.stringify(logged).includes(secret),false);assert.equal(f.creates,0);
}));
test('nominal save re-reads Notion and verifies the server-assigned identity through Core',()=>withFixture({},async f=>{const r=await f.adapter.saveAnalysis(input());assert.equal(r.status,'ok');assert.equal(r.data.status,'verified');assert.notEqual(r.data.analysisId,compact(proposedId));assert.equal(f.creates,1);assert.equal(f.promotions,1);const current=await f.adapter.getCurrentAnalysis(compact(companyId),'business');assert.equal(current.status,'ok');assert.equal(current.data.header.id,r.data.analysisId);assert.ok(f.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/pages/')).length>=6);}));
test('creation accepts a canonical intent identity without requiring a physical Notion UUID',()=>withFixture({},async f=>{const draft=input();draft.analysis.header.id='derived:business:canonical-run';draft.analysis.header.status='Draft';const saved=await f.adapter.saveAnalysis(draft);assert.equal(saved.status,'ok');assert.equal(saved.data.persisted,true);assert.notEqual(saved.data.analysisId,draft.analysis.header.id);assert.equal(f.creates,1);const update={...draft,runId:'invalid-target-update',expectedRevision:saved.data.revision};await assert.rejects(f.writer(update),{code:'invalid_input'});assert.equal(f.creates,1);}));
test('same run re-reads actual state without duplicate or repeat promotion',()=>withFixture({},async f=>{const first=await f.writer(input());const again=await f.writer(input());assert.equal(again.status,'verified');assert.equal(again.analysisId,first.analysisId);assert.equal(f.creates,1);assert.equal(f.promotions,1);}));
test('validated save indexes the promoted Current relation without rebuilding unrelated links',()=>withFixture({},async f=>{const saved=await f.writer(input());assert.equal(saved.status,'verified');const current=await f.db.prepare("SELECT target_page_id FROM notion_relations WHERE LOWER(REPLACE(source_page_id,'-',''))=? AND property_name='Current Business Analysis'").bind(compact(companyId)).first();assert.equal(compact(current.target_page_id),saved.analysisId);const company=await f.db.prepare('SELECT company_page_id FROM notion_document_companies WHERE LOWER(REPLACE(document_page_id,\'-\',\'\'))=?').bind(saved.analysisId).first();assert.equal(compact(company.company_page_id),compact(companyId));}));
test('incompatible same run conflicts before another create',()=>withFixture({},async f=>{await f.writer(input());const changed=input();changed.analysis.header.title='Different';await assert.rejects(f.writer(changed),{code:'stale_request'});assert.equal(f.creates,1);}));
test('stale expectedRevision cannot mutate an existing analysis',()=>withFixture({},async f=>{const r=await f.writer(input());const changed=input({runId:'next-run',expectedRevision:'stale'});changed.analysis.header.id=r.analysisId;await assert.rejects(f.writer(changed),{code:'stale_request'});assert.equal(f.creates,1);}));
test('Company absent fails before persistence',()=>withFixture({missingCompany:true},async f=>{await assert.rejects(f.writer(input()),{code:'not_found'});assert.equal(f.creates,0);}));
test('inconsistent input Company relation is rejected before mutation',()=>withFixture({},async f=>{const changed=input({companyIds:[compact(proposedId)]});const r=await f.adapter.saveAnalysis(changed);assert.equal(r.status,'error');assert.equal(r.error.code,'invalid_input');const malformed=input({companyIds:[5]});assert.equal((await f.adapter.saveAnalysis(malformed)).error.code,'invalid_input');assert.equal(f.creates,0);}));
test('persistence OK / promotion KO returns resumable pending and safely resumes',()=>withFixture({promotionFail:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'promotion_pending');assert.equal(r.persisted,true);assert.equal(r.verified,false);f.flags.promotionFail=false;assert.equal((await f.writer(input())).status,'verified');assert.equal(f.creates,1);}));
test('promotion OK / final verification KO never returns verified',()=>withFixture({failFinalRead:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.persisted,true);assert.equal(r.promoted,true);assert.equal(r.verified,false);}));
test('ambiguous create timeout reconciles Run ID before any mutation retry',()=>withFixture({createTimeout:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'verified');assert.equal(f.creates,1);const creation=f.calls.findIndex(c=>c.path==='/pages');assert.ok(f.calls.slice(creation+1).some(c=>c.path.endsWith('/query')));}));
test('ambiguous promotion reconciles Company rather than blindly repeating PATCH',()=>withFixture({promotionTimeout:true},async f=>{assert.equal((await f.writer(input())).status,'verified');assert.equal(f.promotions,1);}));
test('rate limited mutation is attempted once and does not certify persistence',()=>withFixture({rateLimit:true},async f=>{await assert.rejects(f.writer(input()),{code:'rate_limit'});assert.equal(f.calls.filter(c=>c.path==='/pages').length,1);assert.equal(f.creates,0);}));
test('wrong final Current returns partial, never verified',()=>withFixture({wrongFinalCurrent:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.verified,false);}));
test('concurrent same-run writers share the D1 lease and create at most one page',()=>withFixture({},async f=>{const results=await Promise.allSettled([f.writer(input()),f.writer(input())]);assert.equal(f.creates,1);assert.ok(results.some(r=>r.status==='fulfilled'));for(const result of results)if(result.status==='rejected')assert.equal(result.reason.code,'stale_request');else assert.equal(result.value.status,'verified');}));
test('metadata update checks source revision and preserves the existing report body',()=>withFixture({},async f=>{const r=await f.writer(input());const p=f.pages.get(r.analysisId);const changed=input({runId:'update-run',expectedRevision:p.last_edited_time});changed.analysis.header.id=r.analysisId;changed.analysis.header.title='Updated fixture';const saved=await f.writer(changed);assert.equal(saved.status,'verified');assert.equal(saved.analysisId,r.analysisId);assert.equal(f.creates,1);}));
test('position reads source lifecycle: open, closed, absent, inconsistent and invalid',()=>withFixture({},async f=>{
 const save=(id,status,quantity)=>f.sql.prepare('INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)').run(id,'portfolio','Fixture position',`https://notion.so/${id}`,'2026-10-02T00:00:00Z',JSON.stringify({Position:{type:'title',title:[{plain_text:'Fixture position'}]},Status:{type:'select',select:{name:status}},Quantity:{type:'number',number:quantity},PRU:{type:'number',number:10},'Current Price':{type:'number',number:12},'Price Currency':{type:'select',select:{name:'EUR'}}}),'[]','','2026-10-02T00:00:00Z');
 const open='44444444-4444-4444-8444-444444444444',closed='55555555-5555-4555-8555-555555555555',bad='66666666-6666-4666-8666-666666666666';
 save(open,'Active',2);save(closed,'Sold',0);save(bad,'Active',0);
 assert.equal((await f.adapter.getPosition(compact(open),{cacheOnly:true})).data.lifecycle,'open');
 assert.equal((await f.adapter.getPosition(compact(closed))).data.lifecycle,'closed');
 assert.equal((await f.adapter.getPosition(compact(proposedId))).data,null);
 assert.equal((await f.adapter.getPosition(compact(bad))).error.code,'mapping');
 assert.equal((await f.adapter.getPosition(' ')).error.code,'invalid_input');
 f.sql.prepare("UPDATE notion_documents SET properties_json=? WHERE page_id=?").run(JSON.stringify({Status:{type:'select',select:{name:'Inactive'}},Quantity:{type:'number',number:0}}),bad);
 assert.equal((await f.adapter.getPosition(compact(bad))).error.code,'mapping','inactive is not proof of closure');
}));

test('unresolved ambiguous create is fenced across replays, not blindly retried',()=>withFixture({createTimeoutBefore:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.persisted,false);assert.equal((await f.writer(input())).status,'partial');assert.equal(f.calls.filter(c=>c.path==='/pages').length,1);assert.equal(f.creates,0);}));
test('Draft persistence is readable through MCP Core without promoting Current',()=>withFixture({},async f=>{const draft=input();draft.analysis.header.status='Draft';const r=await f.writer(draft);assert.equal(r.status,'persisted');assert.equal(r.persisted,true);assert.equal(r.promoted,false);assert.equal(r.verified,false);assert.equal(f.promotions,0);const read=await f.api.createInvestmentService(f.db).getAnalysisById(r.analysisId);assert.equal(read.status,'ok');assert.equal(read.data.header.id,r.analysisId);assert.equal(read.data.header.status,'Draft');}));
test('Draft save and replay update only their page indexes and avoid a second create',()=>withFixture({},async f=>{const draft=input();draft.analysis.header.status='Draft';const childrenReads=()=>f.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/blocks/')&&c.path.includes('/children')).length;const first=await f.writer(draft);assert.equal(first.status,'persisted');assert.equal(childrenReads(),1);const link=await f.db.prepare('SELECT company_page_id FROM notion_document_companies WHERE document_page_id=?').bind(f.pages.get(first.analysisId).id).first();assert.equal(compact(link.company_page_id),compact(companyId));const relation=await f.db.prepare("SELECT target_page_id FROM notion_relations WHERE source_page_id=? AND property_name='Company'").bind(f.pages.get(first.analysisId).id).first();assert.equal(compact(relation.target_page_id),compact(companyId));await f.db.prepare("INSERT INTO notion_document_companies VALUES ('unrelated','unrelated','notion-relation','now')").run();const replay=await f.writer(draft);assert.equal(replay.status,'persisted');assert.equal(replay.analysisId,first.analysisId);assert.equal(childrenReads(),3);assert.equal((await f.db.prepare("SELECT count(*) AS n FROM notion_document_companies WHERE document_page_id='unrelated'").first()).n,1);assert.equal(f.creates,1);assert.equal(f.promotions,0);}));
test('adapter canonicalizes dashed update identity before receipt validation',()=>withFixture({},async f=>{const r=await f.writer(input());const existing=f.pages.get(r.analysisId),changed=input({runId:'dashed-update',expectedRevision:existing.last_edited_time});changed.analysis.header.id=existing.id;changed.companyIds=[companyId];changed.analysis.header.companyIds=[companyId];changed.analysis.header.title='Updated dashed';assert.equal((await f.adapter.saveAnalysis(changed)).data.status,'verified');}));

test('long report is written in bounded chunks and completely re-read before verified',()=>withFixture({},async f=>{const report=input();report.analysis.content.blocks=Array.from({length:205},(_,n)=>({id:`p-${n}`,sourceIds:[`source-${n}`],type:'paragraph',text:[{text:`Paragraph ${n}`,marks:[],href:null}]}));const r=await f.writer(report);assert.equal(r.status,'verified');assert.equal(f.blocks.get(r.analysisId).length,205);assert.equal(f.calls.filter(c=>c.method==='PATCH'&&c.path.endsWith('/children')).length,2);}));
test('long Draft certifies the final append with a complete read without a redundant full scan',()=>withFixture({},async f=>{
 const report=input();report.analysis.header.status='Draft';report.analysis.content.blocks=Array.from({length:205},(_,n)=>({id:`p-${n}`,sourceIds:[`source-${n}`],type:'paragraph',text:[{text:`Paragraph ${n}`,marks:[],href:null}]}));
 const saved=await f.writer(report);assert.equal(saved.status,'persisted');assert.equal(saved.persisted,true);assert.equal(f.promotions,0);assert.equal(f.blocks.get(saved.analysisId).length,205);
 const reads=f.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/blocks/'));assert.equal(reads.length,6);assert.ok(f.calls.some(c=>c.method==='GET'&&c.path.startsWith('/pages/')&&compact(c.path).includes(saved.analysisId)));
}));
test('long Draft cannot certify content changed during the final append read',()=>withFixture({},async f=>{
 const report=input();report.analysis.header.status='Draft';report.analysis.content.blocks=Array.from({length:105},(_,n)=>({id:`p-${n}`,sourceIds:[`source-${n}`],type:'paragraph',text:[{text:`Paragraph ${n}`,marks:[],href:null}]}));
 const writer=f.api.createNotionAnalysisWriter(f.db,{...f.options,fetch:async(url,options)=>{const response=await f.options.fetch(url,options);if(options.method==='PATCH'&&new URL(url).pathname.endsWith('/children')){const stored=[...f.blocks.values()][0];stored[0].paragraph.rich_text[0].text.content='Concurrent change';}return response;}});
 const saved=await writer(report);assert.equal(saved.status,'partial');assert.equal(saved.persisted,false);assert.equal(saved.verified,false);assert.equal(f.promotions,0);
}));
test('ambiguous append reconciles the exact block prefix without duplicating content',()=>withFixture({appendTimeout:true},async f=>{const report=input();report.analysis.content.blocks=Array.from({length:105},(_,n)=>({id:`p-${n}`,sourceIds:[`source-${n}`],type:'paragraph',text:[{text:`Paragraph ${n}`,marks:[],href:null}]}));const r=await f.writer(report);assert.equal(r.status,'verified');assert.equal(f.blocks.get(r.analysisId).length,105);assert.equal(f.calls.filter(c=>c.method==='PATCH'&&c.path.endsWith('/children')).length,1);}));

test('lost D1 lease is detected before a Current mutation',()=>withFixture({stealLease:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.verified,false);assert.equal(f.promotions,0);}));

test('production shared Run ID remains idempotent independently for Business and Valuation modules',()=>withFixture({},async f=>{const business=await f.writer(input());const valuation=input();valuation.analysis.kind='valuation';valuation.analysis.header.family='valuation';valuation.analysis.header.agent='Valuation Analyst';valuation.analysis.header.title='Fixture valuation';const result=await f.writer(valuation);assert.equal(result.status,'verified');assert.notEqual(result.analysisId,business.analysisId);assert.equal((await f.writer(input())).analysisId,business.analysisId);assert.equal((await f.writer(valuation)).analysisId,result.analysisId);assert.equal(f.creates,2);}));

test('physical Company must be a relation; schema mismatch cannot yield verified',()=>withFixture({badCompanyType:true},async f=>{await assert.rejects(f.writer(input()),{code:'mapping'});assert.equal(f.creates,0);}));

test('production source without a Summary property preserves the canonical summary in the report body',()=>withFixture({},async f=>{
 const draft=input();draft.analysis.header.status='Draft';draft.analysis.summary='Business quality remains strong, with an explicit evidence gap.';
 const saved=await f.adapter.saveAnalysis(draft);
 assert.equal(saved.status,'ok');assert.equal(saved.data.status,'persisted');assert.equal(f.creates,1);assert.equal(f.promotions,0);
 const stored=f.blocks.get(saved.data.analysisId);
 assert.equal(stored[0].heading_2.rich_text[0].text.content,'TL;DR');
 assert.equal(stored[1].paragraph.rich_text[0].text.content,draft.analysis.summary);
 assert.equal(stored[2].heading_2.rich_text[0].text.content,'Rapport complet');
 assert.equal(stored[3].paragraph.rich_text[0].text.content,'Fixture report.');
 const read=await f.api.createInvestmentService(f.db).getAnalysisById(saved.data.analysisId);
 assert.equal(read.status,'ok');assert.equal(read.data.header.status,'Draft');assert.equal(read.data.summary,draft.analysis.summary);
}));

test('Company archived during final verification cannot yield verified',()=>withFixture({archiveFinalCompany:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.verified,false);}));

test('revisioned update cannot retype a Business Current page as Valuation',()=>withFixture({},async f=>{const saved=await f.writer(input()),existing=f.pages.get(saved.analysisId);const changed=input({runId:'different-module-update',expectedRevision:existing.last_edited_time});changed.analysis.kind='valuation';changed.analysis.header.family='valuation';changed.analysis.header.agent='Valuation Analyst';changed.analysis.header.id=saved.analysisId;await assert.rejects(f.writer(changed),{code:'stale_request'});assert.equal(existing.properties.Agent.select.name,'Business Analyst');assert.equal(f.creates,1);assert.equal(f.promotions,1);}));

 test('provider diagnostic survives the adapter Core bridge without sensitive content',()=>withFixture({},async f=>{
 const secret='SECRET_VALUE_OR_DOCUMENT';let attempts=0;
 const options={...f.options,fetch:async(url,options)=>{
  if(options.method==='POST'&&new URL(url).pathname==='/v1/pages'){attempts++;return Response.json({object:'error',code:'validation_error',message:`body.children[6].callout.icon should be an object, instead was ${secret}.`,request_id:secret},{status:400});}
  return f.options.fetch(url,options);
 }};
 const result=await f.api.createInvestmentService(f.db,options).saveAnalysis(input());
 assert.equal(result.status,'error');assert.equal(result.error.code,'invalid_input');
 const diagnostic=result.metadata.diagnostics.find(d=>d.code==='notion_validation_error');
 assert.equal(diagnostic.path,'body.children[6].callout.icon');
 assert.match(diagnostic.message,/HTTP 400; type=error; code=validation_error/);assert.match(diagnostic.message,/expected object/);
 assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(attempts,1);assert.equal(f.creates,0);
}));

for(const shape of ['rich-text-array','table-children','link-url','utf8-size'])test(`provider ${shape} limit rejects before a mutation`,()=>withFixture({},async f=>{
 const draft=input();draft.analysis.header.status='Draft';
 const segment={text:'x',marks:[],href:null};
 if(shape==='rich-text-array')draft.analysis.content.blocks[0].text=Array.from({length:101},()=>({...segment}));
 if(shape==='table-children')draft.analysis.content.blocks=[{id:'table',sourceIds:['fixture-source'],type:'table',header:false,rows:Array.from({length:101},()=>[[{...segment}]])}];
 if(shape==='link-url')draft.analysis.content.blocks[0].text=[{...segment,href:'https://example.test/'+ 'x'.repeat(2000)}];
 if(shape==='utf8-size')draft.analysis.content.blocks=Array.from({length:80},(_,n)=>({id:`p-${n}`,sourceIds:['fixture-source'],type:'paragraph',text:[{...segment,text:'界'.repeat(2000)}]}));
 await assert.rejects(f.writer(draft),{code:'invalid_input'});assert.equal(f.creates,0);assert.equal(f.calls.some(c=>c.method==='PATCH'||c.path==='/pages'),false);
}));

test('supported block DTOs omit absent optional values while nullable properties remain valid',()=>withFixture({},async f=>{
 const draft=input();draft.analysis.header.status='Draft';const segment={text:'Provider shape.',marks:['bold'],href:'https://example.test/source'};
 const block=(type,extra={})=>({id:`fixture-${type}`,sourceIds:['fixture-source'],type,...extra});
 draft.analysis.content.blocks=[...['paragraph','quote','callout'].map(type=>block(type,{text:[segment],...(type==='callout'?{icon:null}:{})})),... [1,2,3].map(level=>block('heading',{id:`heading-${level}`,level,text:[segment]})),block('list',{ordered:false,items:[[segment]]}),block('list',{id:'ordered-list',ordered:true,items:[[segment]]}),block('divider'),block('table',{header:true,rows:[[[segment]]]})];
 let captured;
 const writer=f.api.createNotionAnalysisWriter(f.db,{...f.options,fetch:async(url,options)=>{
  if(options.method==='GET'&&new URL(url).pathname.startsWith('/v1/data_sources/')){const schema=await (await f.options.fetch(url,options)).json();Object.assign(schema.properties,{Score:{type:'number'},Confidence:{type:'select'}});return Response.json(schema);}
  if(options.method==='POST'&&new URL(url).pathname==='/v1/pages')captured=JSON.parse(options.body);
  return f.options.fetch(url,options);
 }});
 assert.equal((await writer(draft)).status,'persisted');
 assert.deepEqual(captured.properties.Score,{number:null});assert.deepEqual(captured.properties.Confidence,{select:null});
 assert.deepEqual(captured.children.map(b=>b.type),['paragraph','quote','callout','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','divider','table']);
 function check(value,key=''){if(value===null){assert.ok(['select','status','date','number'].includes(key),`optional ${key} must be omitted`);return;}if(Array.isArray(value))value.forEach(v=>check(v,key));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))check(v,k);}
 check(captured);assert.deepEqual(captured.children[0].paragraph.rich_text[0].text.link,{url:segment.href});
}));
