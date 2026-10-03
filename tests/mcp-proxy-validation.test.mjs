// Temporary synthetic probe tests; no hosting credential or live provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {setImmediate as turn} from 'node:timers/promises';
const b=await build({stdin:{contents:'export * from "./transports/mcp/server.ts"; export * from "./transports/mcp/lot11-proxy-validation.ts";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
await writeFile('.sites-runtime/proxy-validation-test.mjs',b.outputFiles[0].text);
const api=await import('../.sites-runtime/proxy-validation-test.mjs');
const owner={subject:'local-test-owner',scopes:['personal','demo'],permissions:['investment:read'],writeApproved:false};
const args={invocationId:'lot11-local',outputBytes:16384,delayMs:0,deadlineMs:30000,fault:'none'};
const req=(a=args,method='tools/call')=>new Request('http://localhost/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json,text/event-stream','mcp-protocol-version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:method==='tools/list'?{}:{name:'lot11_proxy_validation',arguments:a}})});
const handler=(caller=owner,validation=api.lot11ProxyValidation)=>api.createMcpHandler({authenticate:()=>caller,service:()=>{throw Error('Business service MUST NOT be invoked');},validation});
test('probe owner READ only, origin rejected, anonymous/demo/expired inaccessible',async()=>{
 assert.equal((await handler(null)(req())).status,401);
 const origin=req();origin.headers.set('origin','https://example.test');assert.equal((await handler()(origin)).status,403);
 for(const h of [handler({...owner,scopes:['demo']}),handler(owner,{...api.lot11ProxyValidation,expiresAt:0})]){
  assert.equal((await (await h(req(args,'tools/list'))).json()).result.tools.length,7);
  assert.ok((await (await h(req())).json()).error);
 }
 assert.equal((await (await handler()(req(args,'tools/list'))).json()).result.tools.length,8);
});
test('exact UTF-8 output envelope boundary; >4 MiB rejected; synthetic 413',async()=>{
 const h=handler();
 for(const n of [16384,4194304,4194305]){
  const r=await (await h(req({...args,outputBytes:n}))).json();
  if(n<=4194304){assert.equal(Buffer.byteLength(JSON.stringify(r.result.structuredContent)),n);assert.equal(r.result.structuredContent.result.status,'ok');assert.match(r.result.structuredContent.result.data.name,/SYNTHETIC/);}
  else assert.equal(r.result.structuredContent.error.code,'limit_exceeded');
 }
 assert.equal((await h(req({...args,fault:'http413'}))).status,413);
});
test('same race exercises 30/120 s using only synthetic READ, continuation retained',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 try{
  for(const ms of [30000,120000]){
   const keep=[];const promise=handler()(req({...args,deadlineMs:ms,delayMs:ms+1000}),p=>keep.push(p));
   for(let i=0;i<10;i++)await turn();
   t.mock.timers.tick(ms);await turn();
   const out=(await (await promise).json()).result;
   assert.equal(out.structuredContent.error.code,'timeout');assert.equal(JSON.parse(out.content[0].text).times.coreFinished,null);
   t.mock.timers.tick(1001);await Promise.all(keep);
  }
 }finally{t.mock.timers.reset();}
});
