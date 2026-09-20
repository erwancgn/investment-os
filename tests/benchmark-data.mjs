// Local-only benchmark: same synthetic SQLite fixture and bundled source for each revision.
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { performance } from 'node:perf_hooks';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const output = process.argv[3];
const built = await build({ entryPoints: [path.join(root,'app/lib/investment-data.ts')], bundle:true, write:false, platform:'node', format:'esm' });
const api = await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
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
let queries=0,rows=0;
const db={prepare(text){const wrap=(args=[])=>({bind(...values){return wrap(values)},async all(){queries++;const results=sql.prepare(text).all(...args).map(row=>({...row}));rows+=results.length;return {results}},async first(){queries++;const value=sql.prepare(text).get(...args);rows+=value?1:0;return value?{...value}:null},async run(){queries++;sql.prepare(text).run(...args);return {success:true}}});return wrap();}};
const results={fixture:{companies:60,reports:180,iterations:30},scenarios:{}};
for(const [name,invoke] of [['analyses',()=>api.listResearchDocuments(db)],['company',()=>api.getCompanyDetail(db,cid(14))],['document',()=>api.getResearchDocument(db,did(14))],['portfolio',()=>api.getLivePortfolio(db,false)]]){
 await invoke(); const times=[];let sample;
 queries=0;rows=0;
 for(let i=0;i<30;i++){const start=performance.now();sample=await invoke();times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 results.scenarios[name]={medianMs:times[14],p95Ms:times[28],queries:queries/30,rowsReturned:rows/30,responseBytes:Buffer.byteLength(JSON.stringify(sample)),sample};
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(results.scenarios).map(([k,v])=>[k,{medianMs:v.medianMs,p95Ms:v.p95Ms,queries:v.queries,rowsReturned:v.rowsReturned,responseBytes:v.responseBytes}])),null,2));
if(output){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(results,null,2));}
sql.close();
