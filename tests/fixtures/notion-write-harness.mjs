import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { readFile,writeFile,unlink } from 'node:fs/promises';
import * as fixtures from './investment-contracts.mjs';
let apiPromise;
function loadApi(){return apiPromise??=build({stdin:{contents:'export * from "./adapters/notion/analysis-writes.ts"; export * from "./adapters/notion/investment-reads.ts"; export * from "./adapters/notion/sync.ts";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'}).then(async result=>{const path=`/tmp/investment-os-notion-test-${process.pid}.mjs`;await writeFile(path,result.outputFiles[0].text);try{return await import(`file://${path}`);}finally{await unlink(path);}});}
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

export { fixture, input, withFixture, compact, companyId, proposedId };
