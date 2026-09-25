import test from 'node:test';
import assert from 'node:assert/strict';
import {getQuotes, hasYearOfDailyHistory} from '../app/lib/quotes.ts';
const cached=(currency,price)=>({provider:'yahoo-query2',provider_symbol:'test',native_price:price,native_currency:currency,previous_close:price,market_time:new Date().toISOString(),fetched_at:new Date(Date.now()-600000).toISOString(),validation_flags:'[]'});
const dbFor=rows=>({prepare(){return {run:async()=>{},bind(id){return {first:async()=>rows[id]??null,run:async()=>{}}}}}});
test('a recent IPO with complete daily data is accepted without demanding a year of quotes',()=>{
 const today=new Date('2026-09-24T12:00:00Z');
 const points=Array.from({length:75},(_,index)=>{const date=new Date(today.getTime()-index*86400000).toISOString().slice(0,10);return{date,close:100,adjustedClose:100}}).reverse();
 assert.equal(hasYearOfDailyHistory({providerSymbol:'SPCX',currency:'USD',points,fetchedAt:today.toISOString()}),true);
 const monthly=Array.from({length:6},(_,index)=>{const date=new Date(Date.UTC(2025,index,1)).toISOString().slice(0,10);return{date,close:100,adjustedClose:100}});
 assert.equal(hasYearOfDailyHistory({providerSymbol:'OLD',currency:'USD',points:monthly,fetchedAt:today.toISOString()}),false,'sparse legacy history stays eligible for daily repair');
});
test('expired cache renders converted values without external requests',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('unexpected network')};
 try {const [q]=await getQuotes(['nvda'],false,dbFor({nvda:cached('USD',120),'fx-usd':cached('USD',1.2)}),true);assert.equal(q.eurPrice,100);assert.equal(q.freshness,'stale');assert.ok(q.warnings.some(w=>w.includes('cache_refresh_needed')));}finally{globalThis.fetch=previous;}
});
test('missing cached FX never treats a dollar price as euros',async()=>{
 const [q]=await getQuotes(['nvda'],false,dbFor({nvda:cached('USD',120)}),true);assert.equal(q.eurPrice,null);assert.ok(q.warnings.includes('cache_refresh_needed'));
});
test('empty cache returns unavailable without waiting on providers',async()=>{
 const [q]=await getQuotes(['nvda'],false,dbFor({}),true);assert.equal(q.nativePrice,null);assert.equal(q.freshness,'unavailable');
});
test('currency request starts before the stock response resolves',async()=>{
 const previous=globalThis.fetch;const started=[];let release;const gate=new Promise(r=>{release=r});
 globalThis.fetch=async url=>{const fx=String(url).includes('EURUSD');started.push(fx?'fx':'stock');if(!fx)await gate;return new Response(JSON.stringify({chart:{result:[{meta:{symbol:fx?'EURUSD=X':'NVDA',regularMarketPrice:fx?1.2:120,currency:'USD',regularMarketTime:Math.floor(Date.now()/1000)}}]}}));};
 try{const pending=getQuotes(['nvda'],true);await Promise.resolve();assert.deepEqual(started,['stock','fx']);release();assert.equal((await pending)[0].eurPrice,100);}finally{release();globalThis.fetch=previous;}
});
test('failed live refresh preserves cached prices and marks them stale',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('provider offline')};
 try{const [q]=await getQuotes(['nvda'],true,dbFor({nvda:cached('USD',120),'fx-usd':cached('USD',1.2)}));assert.equal(q.eurPrice,100);assert.equal(q.freshness,'stale');assert.equal(q.isFallback,true);assert.ok(q.warnings.length>0);}finally{globalThis.fetch=previous;}
});
