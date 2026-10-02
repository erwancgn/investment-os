import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { readFile,writeFile } from 'node:fs/promises';
import * as fixtures from './fixtures/investment-contracts.mjs';
let apiPromise;
function loadApi(){return apiPromise??=build({stdin:{contents:'export * from "./adapters/notion/analysis-writes.ts"; export * from "./adapters/notion/investment-reads.ts"; export * from "./adapters/notion/sync.ts";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'}).then(async result=>{await writeFile('/tmp/lot8-adapter-test-bundle.mjs',result.outputFiles[0].text);return import('file:///tmp/lot8-adapter-test-bundle.mjs');});}
const companyId='11111111-1111-4111-8111-111111111111',proposedId='33333333-3333-4333-8333-333333333333';
const compact=id=>id.replaceAll('-','');
function input(extra={}){const header={...fixtures.analysisHeader(),id:compact(proposedId),companyIds:[compact(companyId)],title:'Fixture business',status:'Validated',family:'business',sourceKind:'analysis',agent:'Business Analyst',archived:false};return {analysis:{schemaVersion:'1.0.0',kind:'business',header,content:{schemaVersion:'1.0.0',blocks:[{id:'block-1',sourceIds:['fixture-source'],type:'paragraph',text:[{text:'Fixture report.',marks:[],href:null}]}]},summary:null,verdict:null,confidence:null,presentation:{facts:[],scenarios:[],thresholds:[]},projection:{status:'absent'},diagnostics:[],score:null},companyIds:[compact(companyId)],runId:'fixture-run',expectedRevision:null,...extra};}
async function fixture(flags={}){
 const api=await loadApi();const sql=new DatabaseSync(':memory:');
 for(const file of ['0000_fat_the_spike.sql','0001_notion_sync.sql','0002_notion_sync_cursor.sql','0003_notion_import_jobs.sql','0004_damp_marrow.sql','0005_curious_risque.sql','0006_dazzling_maginty.sql'])sql.exec((await readFile(`drizzle/${file}`,'utf8')).replaceAll('--> statement-breakpoint',''));
 const db={prepare(query){const s=sql.prepare(query);let bindings=[];const stmt={bind(...v){bindings=v;return stmt;},async all(){return {results:s.all(...bindings)};},async first(){return s.get(...bindings)??null;},async run(){return {meta:{changes:Number(s.run(...bindings).changes)}};}};return stmt;},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
 const sources=api.notionSources,pages=new Map(),blocks=new Map(),calls=[],revisions={n:0};let creates=0,promotions=0;
 const typed=properties=>Object.fromEntries(Object.entries(properties).map(([name,p])=>{const type=Object.keys(p)[0],value=structuredClone(p);if(type==='rich_text'||type==='title')value[type]=value[type].map(r=>({...r,plain_text:r.text.content}));return [name,{type,...value}];}));
 const revision=()=>new Date(Date.UTC(2026,9,2,0,0,++revisions.n)).toISOString();
 const company={id:companyId,parent:{data_source_id:sources.companies},last_edited_time:revision(),properties:typed({'Current Business Analysis':{relation:[]},'Current Valuation Analysis':{relation:[]},Company:{title:[{text:{content:'Fixture Co'}}]}})};
 if(!flags.missingCompany)pages.set(compact(companyId),company);
 const schema={properties:Object.fromEntries(Object.entries({Name:'title','Run ID':'rich_text',Company:'relation',Agent:'select',Status:'select','Analysis Date':'date','Source Freshness':'select'}).map(([name,type])=>[name,{type}]))};
 if(flags.badCompanyType)schema.properties.Company.type='rich_text';
 const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
 const fetch=async(url,options)=>{
  const u=new URL(url),path=u.pathname.replace('/v1',''),method=options.method,body=options.body?JSON.parse(options.body):null;
  calls.push({path,method,body});
  if(flags.rateLimit&&method==='POST'&&path==='/pages')return response({},429);
  if(path.startsWith('/data_sources/')&&method==='GET')return response(schema);
  if(path.endsWith('/query'))return response({results:[...pages.values()].filter(p=>p.parent.data_source_id===path.split('/')[2]&&p.properties['Run ID']?.rich_text?.map(x=>x.text.content).join('')===body.filter.rich_text.equals),has_more:false});
  if(path==='/pages'&&method==='POST'){
   if(flags.createTimeoutBefore)throw Object.assign(new Error('timeout'),{name:'TimeoutError'});
   creates++;const page={id:`22222222-2222-4222-8222-${String(creates).padStart(12,'2')}`,last_edited_time:revision(),url:'https://notion.so/fixture-analysis',parent:body.parent,properties:typed(body.properties)};pages.set(compact(page.id),page);blocks.set(compact(page.id),structuredClone(body.children).map((b,i)=>({...b,id:`bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12,'b')}`,has_children:false})));
   if(flags.createTimeout){flags.createTimeout=false;throw Object.assign(new Error('timeout'),{name:'TimeoutError'});}return response(page);
  }
  if(path.startsWith('/blocks/')&&path.endsWith('/children')){
   const key=compact(path.split('/')[2]);
   if(method==='PATCH'){
    const old=blocks.get(key)??[];blocks.set(key,[...old,...body.children.map((b,i)=>({...b,id:`cccccccc-cccc-4ccc-8ccc-${String(old.length+i).padStart(12,'c')}`,has_children:false}))]);
    if(flags.appendTimeout){flags.appendTimeout=false;throw new TypeError('response lost');}
    return response({results:blocks.get(key),has_more:false});
   }
   const all=blocks.get(key)??[],start=Number(u.searchParams.get('start_cursor')??0),end=start+100;
   return response({results:all.slice(start,end),has_more:end<all.length,next_cursor:end<all.length?String(end):null});
  }
  if(path.startsWith('/pages/')){
   const page=pages.get(compact(path.split('/')[2]));if(!page)return response({},404);
   if(method==='PATCH'){
    const isCompany=compact(page.id)===compact(companyId);
    if(isCompany&&flags.promotionFail)return response({},403);
    Object.assign(page.properties,typed(body.properties));page.last_edited_time=revision();if(isCompany)promotions++;
    if(isCompany&&flags.promotionTimeout){flags.promotionTimeout=false;throw new TypeError('response lost');}
    return response(page);
   }
   if(promotions&&flags.failFinalRead&&compact(page.id)!==compact(companyId))throw new TypeError('network');
   if(flags.stealLease&&compact(page.id)===compact(companyId)&&creates){flags.stealLease=false;sql.prepare("UPDATE notion_analysis_writes SET owner='another-writer',lease_until=?").run(Date.now()+180000);}
   const copy=structuredClone(page);
   if(promotions&&flags.archiveFinalCompany&&compact(page.id)===compact(companyId))copy.archived=true;
   if(promotions&&flags.wrongFinalCurrent&&compact(page.id)===compact(companyId))copy.properties['Current Business Analysis'].relation=[{id:proposedId}];
   return response(copy);
  }
  throw new Error(`Unexpected ${method} ${path}`);
 };
 const options={token:'fixture-only',fetch,sleep:async()=>{}};
 return {api,sql,db,flags,pages,blocks,calls,company,sources,options,writer:api.createNotionAnalysisWriter(db,options),adapter:api.createInvestmentAdapter(db,options),get creates(){return creates;},get promotions(){return promotions;}};
}
const withFixture=async(flags,fn)=>{const f=await fixture(flags);try{await fn(f);}finally{f.sql.close();}};
test('nominal save re-reads Notion and verifies the server-assigned identity through Core',()=>withFixture({},async f=>{const r=await f.adapter.saveAnalysis(input());assert.equal(r.status,'ok');assert.equal(r.data.status,'verified');assert.notEqual(r.data.analysisId,compact(proposedId));assert.equal(f.creates,1);assert.equal(f.promotions,1);const current=await f.adapter.getCurrentAnalysis(compact(companyId),'business');assert.equal(current.status,'ok');assert.equal(current.data.header.id,r.data.analysisId);assert.ok(f.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/pages/')).length>=6);}));
test('same run re-reads actual state without duplicate or repeat promotion',()=>withFixture({},async f=>{const first=await f.writer(input());const again=await f.writer(input());assert.equal(again.status,'verified');assert.equal(again.analysisId,first.analysisId);assert.equal(f.creates,1);assert.equal(f.promotions,1);}));
test('incompatible same run conflicts before another create',()=>withFixture({},async f=>{await f.writer(input());const changed=input();changed.analysis.header.title='Different';await assert.rejects(f.writer(changed),{code:'stale_request'});assert.equal(f.creates,1);}));
test('stale expectedRevision cannot mutate an existing analysis',()=>withFixture({},async f=>{const r=await f.writer(input());const changed=input({runId:'next-run',expectedRevision:'stale'});changed.analysis.header.id=r.analysisId;await assert.rejects(f.writer(changed),{code:'stale_request'});assert.equal(f.creates,1);}));
test('Company absent fails before persistence',()=>withFixture({missingCompany:true},async f=>{await assert.rejects(f.writer(input()),{code:'not_found'});assert.equal(f.creates,0);}));
test('inconsistent input Company relation is rejected before mutation',()=>withFixture({},async f=>{const changed=input({companyIds:[compact(proposedId)]});const r=await f.adapter.saveAnalysis(changed);assert.equal(r.status,'error');assert.equal(r.error.code,'invalid_input');const malformed=input({companyIds:[5]});assert.equal((await f.adapter.saveAnalysis(malformed)).error.code,'invalid_input');assert.equal(f.creates,0);}));
test('persistence OK / promotion KO returns resumable pending and safely resumes',()=>withFixture({promotionFail:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'promotion_pending');assert.equal(r.persisted,true);assert.equal(r.verified,false);f.flags.promotionFail=false;assert.equal((await f.writer(input())).status,'verified');assert.equal(f.creates,1);}));
test('promotion OK / final verification KO never returns verified',()=>withFixture({failFinalRead:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.persisted,true);assert.equal(r.promoted,true);assert.equal(r.verified,false);}));
test('ambiguous create timeout reconciles Run ID before any mutation retry',()=>withFixture({createTimeout:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'verified');assert.equal(f.creates,1);const creation=f.calls.findIndex(c=>c.path==='/pages');assert.ok(f.calls.slice(creation+1).some(c=>c.path.endsWith('/query')));}));
test('ambiguous promotion reconciles Company rather than blindly repeating PATCH',()=>withFixture({promotionTimeout:true},async f=>{assert.equal((await f.writer(input())).status,'verified');assert.equal(f.promotions,1);}));
test('rate limit mutation retries are bounded and do not certify persistence',()=>withFixture({rateLimit:true},async f=>{await assert.rejects(f.writer(input()),{code:'rate_limit'});assert.equal(f.calls.filter(c=>c.path==='/pages').length,3);assert.equal(f.creates,0);}));
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
test('Draft persistence does not promote Current or claim verified',()=>withFixture({},async f=>{const draft=input();draft.analysis.header.status='Draft';const r=await f.writer(draft);assert.equal(r.status,'persisted');assert.equal(r.persisted,true);assert.equal(r.promoted,false);assert.equal(r.verified,false);assert.equal(f.promotions,0);}));
test('adapter canonicalizes dashed update identity before receipt validation',()=>withFixture({},async f=>{const r=await f.writer(input());const existing=f.pages.get(r.analysisId),changed=input({runId:'dashed-update',expectedRevision:existing.last_edited_time});changed.analysis.header.id=existing.id;changed.companyIds=[companyId];changed.analysis.header.companyIds=[companyId];changed.analysis.header.title='Updated dashed';assert.equal((await f.adapter.saveAnalysis(changed)).data.status,'verified');}));

test('long report is written in bounded chunks and completely re-read before verified',()=>withFixture({},async f=>{const report=input();report.analysis.content.blocks=Array.from({length:205},(_,n)=>({id:`p-${n}`,sourceIds:[`source-${n}`],type:'paragraph',text:[{text:`Paragraph ${n}`,marks:[],href:null}]}));const r=await f.writer(report);assert.equal(r.status,'verified');assert.equal(f.blocks.get(r.analysisId).length,205);assert.equal(f.calls.filter(c=>c.method==='PATCH'&&c.path.endsWith('/children')).length,2);}));
test('ambiguous append reconciles the exact block prefix without duplicating content',()=>withFixture({appendTimeout:true},async f=>{const report=input();report.analysis.content.blocks=Array.from({length:105},(_,n)=>({id:`p-${n}`,sourceIds:[`source-${n}`],type:'paragraph',text:[{text:`Paragraph ${n}`,marks:[],href:null}]}));const r=await f.writer(report);assert.equal(r.status,'verified');assert.equal(f.blocks.get(r.analysisId).length,105);assert.equal(f.calls.filter(c=>c.method==='PATCH'&&c.path.endsWith('/children')).length,1);}));

test('lost D1 lease is detected before a Current mutation',()=>withFixture({stealLease:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.verified,false);assert.equal(f.promotions,0);}));

test('production shared Run ID remains idempotent independently for Business and Valuation modules',()=>withFixture({},async f=>{const business=await f.writer(input());const valuation=input();valuation.analysis.kind='valuation';valuation.analysis.header.family='valuation';valuation.analysis.header.agent='Valuation Analyst';valuation.analysis.header.title='Fixture valuation';const result=await f.writer(valuation);assert.equal(result.status,'verified');assert.notEqual(result.analysisId,business.analysisId);assert.equal((await f.writer(input())).analysisId,business.analysisId);assert.equal((await f.writer(valuation)).analysisId,result.analysisId);assert.equal(f.creates,2);}));

test('physical Company must be a relation; schema mismatch cannot yield verified',()=>withFixture({badCompanyType:true},async f=>{await assert.rejects(f.writer(input()),{code:'mapping'});assert.equal(f.creates,0);}));

test('Company archived during final verification cannot yield verified',()=>withFixture({archiveFinalCompany:true},async f=>{const r=await f.writer(input());assert.equal(r.status,'partial');assert.equal(r.verified,false);}));

test('revisioned update cannot retype a Business Current page as Valuation',()=>withFixture({},async f=>{const saved=await f.writer(input()),existing=f.pages.get(saved.analysisId);const changed=input({runId:'different-module-update',expectedRevision:existing.last_edited_time});changed.analysis.kind='valuation';changed.analysis.header.family='valuation';changed.analysis.header.agent='Valuation Analyst';changed.analysis.header.id=saved.analysisId;await assert.rejects(f.writer(changed),{code:'stale_request'});assert.equal(existing.properties.Agent.select.name,'Business Analyst');assert.equal(f.creates,1);assert.equal(f.promotions,1);}));
