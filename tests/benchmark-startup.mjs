// Measures only the controlled client race, not production market-data latency.
import { build } from 'esbuild';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const baselineRoot = process.argv[2];
if (!baselineRoot) throw new Error('Usage: node tests/benchmark-startup.mjs BASELINE_ROOT [OUTPUT_JSON]');
const output = {};
for (const [label,root] of [['v140',baselineRoot],['candidate',process.cwd()]]) {
 const bundled=await build({entryPoints:[root+'/app/lib/resource-cache.ts'],bundle:true,write:false,platform:'node',format:'esm'});
 const {createResourceCache}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
 const times=[];
 for(let i=0;i<30;i++) {
  let calls=0,done;
  const completed=new Promise(resolve=>{done=resolve});
  const cache=createResourceCache(async()=>{const revision=++calls;await new Promise(resolve=>setTimeout(resolve,revision===1?40:20));return new Response(JSON.stringify({revision}));});
  const start=performance.now();
  const off=cache.subscribe('/portfolio',()=>{if(cache.snapshot('/portfolio').data?.revision===2) done(performance.now()-start)});
  const first=cache.read('/portfolio');
  await new Promise(resolve=>setTimeout(resolve,10));cache.invalidate();cache.refreshActive();
  times.push(await completed);await first;off();
 }
 times.sort((a,b)=>a-b);output[label]={iterations:30,medianMs:times[14],p95Ms:times[28]};
}
console.log(JSON.stringify(output,null,2));
if (process.argv[3]) await writeFile(process.argv[3],JSON.stringify(output,null,2));
