import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const source=process.env.LOT12_SITE_SOURCE || '/tmp/investment-os-lot12.ojrzwy';
const require=createRequire(path.join(source,'package.json'));
const {build}=require('esbuild');
const r=await build({entryPoints:[path.join(source,'core/contracts/analysis.ts')],bundle:true,write:false,platform:'node',format:'esm'});
const {isAnalysis}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const root=path.dirname(new URL(import.meta.url).pathname);
const extract=d=>d.calls?d.calls.map(x=>x.arguments.input.analysis):Object.values(d.payloads).map(x=>x.input.analysis);
const text=a=>a.content.blocks.map(b=>{const values=[];const walk=v=>{if(Array.isArray(v))for(const x of v)walk(x);else if(v&&typeof v==='object'){if(typeof v.text==='string')values.push(v.text);else for(const x of Object.values(v))walk(x);}};for(const key of ['text','items','rows'])walk(b[key]);return [b.id,b.type,values];});
let count=0;
for(const name of ['lot12_lite_reviewable_inline_ed_complete.json','nvda_full_analysis_bundle.json']){
 const old=extract(JSON.parse(fs.readFileSync(path.join(root,'original-'+name))));
 const canonical=extract(JSON.parse(fs.readFileSync(path.join(root,name))));
 assert.equal(old.length,canonical.length);
 for(let i=0;i<old.length;i++){
  assert.equal(isAnalysis(old[i]),false,name+' old '+old[i].kind+' must fail');
  assert.equal(isAnalysis(canonical[i]),true,name+' canonical '+canonical[i].kind+' must pass');
  assert.deepEqual(text(old[i]),text(canonical[i]),name+' financial report changed');
  count++;
 }
}
console.log(`PASS ${count} original payloads rejected, ${count} canonical reference payloads accepted; financial report text unchanged. Runtime native-output proof remains separate.`);
