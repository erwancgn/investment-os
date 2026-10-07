// Local-only benchmark: same synthetic SQLite fixture and bundled source for each revision.
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { performance } from 'node:perf_hooks';
import { readFile, readdir, mkdir, writeFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
const root = path.resolve(process.argv[2] || '.');
const output = process.argv[3];
const normalizationMetricName='__lot6NormalizationMetrics';
globalThis[normalizationMetricName]={calls:0,elapsedMs:0};
const normalizationProbe={name:'lot6-normalization-probe',setup(builder){builder.onLoad({filter:/document-presentation\.ts$/},async args=>{let contents=await readFile(args.path,'utf8');const signature='export function normalizeAnalysisDocument(document: CompanyDocument): NormalizedAnalysisDocument {';if(!contents.includes(signature))throw new Error('normalizeAnalysisDocument probe anchor changed');contents=contents.replace(signature,'function normalizeAnalysisDocumentMeasured(document: CompanyDocument): NormalizedAnalysisDocument {');contents+=`\nexport function normalizeAnalysisDocument(document: CompanyDocument): NormalizedAnalysisDocument { const metrics=(globalThis as any)[${JSON.stringify(normalizationMetricName)}]; const start=performance.now(); try { return normalizeAnalysisDocumentMeasured(document); } finally { metrics.calls++; metrics.elapsedMs+=performance.now()-start; } }\n`;return {contents,loader:'ts'};});}};
const built = await build({ entryPoints: [path.join(root,'app/lib/investment-data.ts')], bundle:true, write:false, platform:'node', format:'esm',plugins:[normalizationProbe] });
const api = await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const previewBuilt=await build({entryPoints:[path.join(root,'app/lib/company-preview.ts')],bundle:true,write:false,platform:'node',format:'esm',plugins:[normalizationProbe]});
const {companyPreview}=await import('data:text/javascript;base64,'+Buffer.from(previewBuilt.outputFiles[0].text).toString('base64'));
const sql = new DatabaseSync(':memory:');
for (const f of (await readdir(path.join(root,'drizzle'))).filter(f=>f.endsWith('.sql')).sort()) sql.exec(await readFile(path.join(root,'drizzle',f),'utf8'));
const rich = value=>({type:'rich_text',rich_text:[{plain_text:value,text:{content:value}}]});
const relation = id=>({type:'relation',relation:[{id}]});
const cid=i=>'00000000000040008000'+String(i).padStart(12,'0');
const did=i=>'10000000000040008000'+String(i).padStart(12,'0');
const insert = sql.prepare('INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)');
for(let i=1;i<=60;i++) {
  const props={Ticker:rich('DM'+i),'Current Business Analysis':relation(did(i))};
  insert.run(cid(i),'companies','Demo '+i,'https://example.invalid/'+cid(i),'2026-09-07T10:00:00Z',JSON.stringify(props),'[]','','2026-09-07T10:00:00Z');
  for(let revision=0;revision<3;revision++) {
    const id=did(i+revision*60);
    const body='## Business\n\n'+('Evidence for synthetic company '+i+'. ').repeat(200)+'\n\n## TL;DR\n\nRésumé humain conservé pour Demo '+i+'.';
    const props={Company:relation(cid(i)),Agent:rich('Business Analyst'),Status:rich('Validated'),'Source Freshness':rich(revision?'Archived':'Current')};
    insert.run(id,'analyses','Demo '+i+' Business','https://example.invalid/'+id,`2026-09-0${7-revision}T10:00:00Z`,JSON.stringify(props),JSON.stringify([{type:'paragraph',paragraph:{rich_text:[{plain_text:body,text:{content:body}}]}}]),body,'2026-09-07T10:00:00Z');
  }
}
const counters = {queries:0,rowsReturned:0,sqlBytesReturned:0,blocksRows:0,blocksBytes:0,fullPlainTextRows:0,fullPlainTextBytes:0,fullBodyRows:0,fullBodyBytes:0,aggregateSqlMs:0};
const observedSelects = new Set();
function accountRow(row,text){const hasFullText=Object.hasOwn(row,'plain_text')&&!/\bSUBSTR\s*\(\s*plain_text\b/i.test(text);const fullText=hasFullText?String(row.plain_text??''):'';const blocks=Object.hasOwn(row,'blocks_json')?String(row.blocks_json??''):'';const blockBytes=Buffer.byteLength(blocks);const textBytes=Buffer.byteLength(fullText);counters.sqlBytesReturned+=Buffer.byteLength(JSON.stringify(row));if(blocks){counters.blocksRows++;counters.blocksBytes+=blockBytes;}if(fullText){counters.fullPlainTextRows++;counters.fullPlainTextBytes+=textBytes;}if(blocks||fullText){counters.fullBodyRows++;counters.fullBodyBytes+=blockBytes+textBytes;}}
const db={prepare(text){const normalized=text.trim();if(/^SELECT\b/i.test(normalized))observedSelects.add(normalized);const wrap=(args=[])=>({bind(...values){return wrap(values)},async all(){counters.queries++;const start=performance.now();const rows=sql.prepare(text).all(...args);counters.aggregateSqlMs+=performance.now()-start;counters.rowsReturned+=rows.length;for(const row of rows)accountRow(row,text);return {results:rows.map(row=>({...row}))}},async first(){counters.queries++;const start=performance.now();const row=sql.prepare(text).get(...args);counters.aggregateSqlMs+=performance.now()-start;if(row){counters.rowsReturned++;accountRow(row,text);}return row?{...row}:null},async run(){counters.queries++;const start=performance.now();sql.prepare(text).run(...args);counters.aggregateSqlMs+=performance.now()-start;return {success:true}}});return wrap();}};
const resetCounters=()=>{for(const key of Object.keys(counters))counters[key]=0;};
const copyCounters=()=>({...counters});
const subtractCounters=(after,before)=>Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-before[key]]));
const heapPollMs=2;
async function measure(invoke){
 if(globalThis.gc)globalThis.gc();
 const heapStart=process.memoryUsage().heapUsed;let peakHeap=heapStart;
 const timer=setInterval(()=>{peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed)},heapPollMs);
 const before=copyCounters();const normalizationBefore={...globalThis[normalizationMetricName]};const cpuStart=process.cpuUsage();const start=performance.now();
 let sample;try{sample=await invoke();}finally{clearInterval(timer);}
 const elapsedMs=performance.now()-start;const cpu=process.cpuUsage(cpuStart);const heapEnd=process.memoryUsage().heapUsed;
 const queryMetrics=subtractCounters(copyCounters(),before);
 const normalizationAfter=globalThis[normalizationMetricName];
 return {sample,metrics:{elapsedMs,cpuUsageMicroseconds:cpu,heapStartBytes:heapStart,heapDeltaBytes:heapEnd-heapStart,heapPeakSampledBytes:Math.max(peakHeap,heapEnd),heapPeakIsLowerBound:true,heapEndBytes:heapEnd,normalizationCalls:normalizationAfter.calls-normalizationBefore.calls,normalizationMs:normalizationAfter.elapsedMs-normalizationBefore.elapsedMs,...queryMetrics,nonSqlMs:Math.max(0,elapsedMs-queryMetrics.aggregateSqlMs)}};
}
function measureSerialization(sample){if(globalThis.gc)globalThis.gc();const heapStart=process.memoryUsage().heapUsed;const cpuStart=process.cpuUsage();const start=performance.now();const body=JSON.stringify(sample);const elapsedMs=performance.now()-start;const heapEnd=process.memoryUsage().heapUsed;return {elapsedMs,cpuUsageMicroseconds:process.cpuUsage(cpuStart),heapStartBytes:heapStart,heapDeltaBytes:heapEnd-heapStart,heapPeakSampledBytes:Math.max(heapStart,heapEnd),heapPeakIsLowerBound:true,heapEndBytes:heapEnd,responseBytes:Buffer.byteLength(body)};}
function quantile(values,fraction){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.ceil(fraction*sorted.length)-1)];}
function summarize(operations){const metrics=operations.map(operation=>operation.metrics);const sum=key=>metrics.reduce((total,item)=>total+key.split('.').reduce((value,part)=>value?.[part],item),0);return {
  iterations:metrics.length,
  medianMs:quantile(metrics.map(item=>item.elapsedMs),.5),p95Ms:quantile(metrics.map(item=>item.elapsedMs),.95),
  totalCpuUsageMicroseconds:{user:sum('cpuUsageMicroseconds.user'),system:sum('cpuUsageMicroseconds.system')},
  meanHeapDeltaBytes:sum('heapDeltaBytes')/metrics.length,peakSampledHeapBytes:Math.max(...metrics.map(item=>item.heapPeakSampledBytes)),meanHeapEndBytes:sum('heapEndBytes')/metrics.length,
  aggregate:{queries:sum('queries'),rowsReturned:sum('rowsReturned'),sqlBytesReturned:sum('sqlBytesReturned'),blocksRows:sum('blocksRows'),blocksBytes:sum('blocksBytes'),fullPlainTextRows:sum('fullPlainTextRows'),fullPlainTextBytes:sum('fullPlainTextBytes'),fullBodyRows:sum('fullBodyRows'),fullBodyBytes:sum('fullBodyBytes'),aggregateSqlMs:sum('aggregateSqlMs'),normalizationCalls:sum('normalizationCalls'),normalizationMs:sum('normalizationMs'),nonSqlMs:sum('nonSqlMs')},
  operations:metrics,
};}
const results={fixture:{companies:60,reports:180,iterations:30,synthetic:true},measurement:{heapSampleIntervalMs:heapPollMs,heapPeakExact:false,heapPeakMeaning:'maximum of sampled values and operation start/end; lower bound when a synchronous section blocks polling',gcForced:Boolean(globalThis.gc),sqlMs:'SQLite statement execution only; API mapping, normalization, and result construction are included in nonSqlMs; normalizeAnalysisDocument time is also measured separately',cold:'first measured request after module build and fixture setup; not a process-cold or production request',warm:'30 measured requests after first request',serialization:'JSON.stringify measured separately after API call; excludes browser/network/worker transport',rendering:'No browser paint is measured by this benchmark'},scenarios:{}};
const invokeByName={analyses:()=>api.listResearchDocuments(db),company:()=>api.getCompanyDetail(db,cid(14)),document:()=>api.getResearchDocument(db,did(14)),portfolio:()=>api.getLivePortfolio(db,false)};
for(const [name,invoke] of Object.entries(invokeByName)){
 resetCounters();const cold=await measure(invoke);const coldCounters=copyCounters();
 const warm=[];let lastWarmSample;for(let i=0;i<30;i++){const operation=await measure(invoke);warm.push({metrics:operation.metrics});lastWarmSample=operation.sample;}
 const warmSummary=summarize(warm);const warmCounters=subtractCounters(copyCounters(),coldCounters);
 const serialization=measureSerialization(lastWarmSample);
 const coldSerialization=measureSerialization(cold.sample);
 results.scenarios[name]={cold:{...cold.metrics,serialization:coldSerialization},warm:{...warmSummary,aggregate:{...warmSummary.aggregate,...warmCounters}},serialization,responseBytes:serialization.responseBytes,sample:lastWarmSample};
}
const companyInput=structuredClone(results.scenarios.company.sample);
const previewBody='## Business\n\n'+('Evidence for synthetic company 14. ').repeat(200)+'\n\n## TL;DR\n\nRésumé humain conservé pour Demo 14.';
for(const section of ['analyses','earnings','decisions','portfolioDocuments','archives'])for(const document of companyInput[section]??[]){document.plainText=previewBody;document.notionBlocks=undefined;document.normalizedAnalysis=undefined;document.presentationProjection=undefined;document.presentationStatus=undefined;document.presentationError=undefined;}
resetCounters();const previewCold=await measure(()=>companyPreview(companyInput));const previewWarm=[];let previewWarmSample;for(let i=0;i<30;i++){const operation=await measure(()=>companyPreview(companyInput));previewWarm.push({metrics:operation.metrics});previewWarmSample=operation.sample;}
const previewSummary=summarize(previewWarm);const previewSerialization=measureSerialization(previewWarmSample);
results.scenarios.companyPreview={cold:{...previewCold.metrics,serialization:measureSerialization(previewCold.sample)},warm:previewSummary,serialization:previewSerialization,responseBytes:previewSerialization.responseBytes,sample:previewWarmSample};
const ssrDocument=results.scenarios.company.sample.analyses[0]??results.scenarios.company.sample.archives[0];
if(ssrDocument){
 const ssrRoot=await mkdtemp(path.join(os.tmpdir(),'lot6-ssr-'));
 try{
  await symlink(path.join(process.cwd(),'node_modules'),path.join(ssrRoot,'node_modules'));
  const ssrBundle=await build({entryPoints:[path.join(root,'app/components/analysis-reader.tsx')],bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
  const ssrPath=path.join(ssrRoot,'analysis-reader.mjs');await writeFile(ssrPath,ssrBundle.outputFiles[0].text);
  const {AnalysisReader}=await import(pathToFileURL(ssrPath).href);
  const OriginalDate=globalThis.Date;const fixedNow='2026-09-30T12:00:00Z';
  class FixedDate extends OriginalDate{constructor(...args){if(args.length)super(...args);else super(fixedNow);}static now(){return new OriginalDate(fixedNow).getTime();}}
  const render=()=>renderToString(React.createElement(AnalysisReader,{document:ssrDocument,companyName:results.scenarios.company.sample.name,embedded:true}));
  globalThis.Date=FixedDate;
  try{
   for(let i=0;i<5;i++)render();
   const times=[];let user=0,system=0,heapStart=0,heapEnd=0,heapPeak=0,htmlBytes=0;
   for(let i=0;i<30;i++){const startHeap=process.memoryUsage().heapUsed;const cpuStart=process.cpuUsage();const start=performance.now();const markup=render();times.push(performance.now()-start);const cpu=process.cpuUsage(cpuStart);user+=cpu.user;system+=cpu.system;heapStart+=startHeap;heapEnd+=process.memoryUsage().heapUsed;heapPeak=Math.max(heapPeak,startHeap,process.memoryUsage().heapUsed);htmlBytes=Buffer.byteLength(markup);}
   results.rendering={kind:'React renderToString SSR only; does not measure hydration, browser layout, paint, network, or user interaction',fixedClock:fixedNow,warmupIterations:5,iterations:30,medianMs:quantile(times,.5),p95Ms:quantile(times,.95),totalCpuUsageMicroseconds:{user,system},meanHeapStartBytes:heapStart/30,meanHeapEndBytes:heapEnd/30,maxHeapStartOrEndBytes:heapPeak,heapPeakIsLowerBound:true,htmlBytes};
  }finally{globalThis.Date=OriginalDate;}
 }finally{await rm(ssrRoot,{recursive:true,force:true});}
}else results.rendering={kind:'React renderToString SSR only; no browser paint measured',skipped:'company fixture has no renderable analysis'};
results.explainQueryPlan=[...observedSelects].map(statement=>{try{const placeholders=(statement.match(/\?(?!\d)/g)??[]).length;return {statement,plan:sql.prepare(`EXPLAIN QUERY PLAN ${statement}`).all(...Array(placeholders).fill(null)).map(row=>String(row.detail??''))};}catch(error){return {statement,error:String(error)}}});
const summary=Object.fromEntries(Object.entries(results.scenarios).map(([name,scenario])=>[name,{coldMs:scenario.cold.elapsedMs,coldCpuUsageMicroseconds:scenario.cold.cpuUsageMicroseconds,coldHeapDeltaBytes:scenario.cold.heapDeltaBytes,coldHeapPeakSampledBytes:scenario.cold.heapPeakSampledBytes,warmMedianMs:scenario.warm.medianMs,warmP95Ms:scenario.warm.p95Ms,warmTotalCpuUsageMicroseconds:scenario.warm.totalCpuUsageMicroseconds,warmMeanHeapDeltaBytes:scenario.warm.meanHeapDeltaBytes,warmMaxHeapPeakSampledBytes:scenario.warm.peakSampledHeapBytes,warmMeanHeapEndBytes:scenario.warm.meanHeapEndBytes,warmQueriesPerRequest:scenario.warm.aggregate.queries/scenario.warm.iterations,warmRowsPerRequest:scenario.warm.aggregate.rowsReturned/scenario.warm.iterations,warmSqlBytesPerRequest:scenario.warm.aggregate.sqlBytesReturned/scenario.warm.iterations,warmBlocksRowsPerRequest:scenario.warm.aggregate.blocksRows/scenario.warm.iterations,warmBlocksBytesPerRequest:scenario.warm.aggregate.blocksBytes/scenario.warm.iterations,warmFullPlainTextRowsPerRequest:scenario.warm.aggregate.fullPlainTextRows/scenario.warm.iterations,warmFullPlainTextBytesPerRequest:scenario.warm.aggregate.fullPlainTextBytes/scenario.warm.iterations,warmFullBodyRowsPerRequest:scenario.warm.aggregate.fullBodyRows/scenario.warm.iterations,warmFullBodyBytesPerRequest:scenario.warm.aggregate.fullBodyBytes/scenario.warm.iterations,warmSqlMsPerRequest:scenario.warm.aggregate.aggregateSqlMs/scenario.warm.iterations,warmNormalizationCallsPerRequest:scenario.warm.aggregate.normalizationCalls/scenario.warm.iterations,warmNormalizationMsPerRequest:scenario.warm.aggregate.normalizationMs/scenario.warm.iterations,warmNonSqlMsPerRequest:scenario.warm.aggregate.nonSqlMs/scenario.warm.iterations,serializationMs:scenario.serialization.elapsedMs,serializationCpuUsageMicroseconds:scenario.serialization.cpuUsageMicroseconds,responseBytes:scenario.responseBytes,queryPlans:results.explainQueryPlan.length}]));
console.log(JSON.stringify(summary,null,2));
console.log(JSON.stringify({rendering:results.rendering,queryPlans:results.explainQueryPlan},null,2));
if(output){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(results,null,2));}
sql.close();
