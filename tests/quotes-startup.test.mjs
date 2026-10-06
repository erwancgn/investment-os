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

const yahoo = prices => async url => {
 const symbol = decodeURIComponent(String(url).match(/chart\/([^?]+)/)?.[1] ?? '');
 const row = prices[symbol]; if (!row) return new Response('{}', { status: 404 });
 return new Response(JSON.stringify({ chart: { result: [{ meta: { symbol, regularMarketPrice: row[0], currency: row[1], chartPreviousClose: row[0], regularMarketTime: Math.floor(Date.now() / 1000) - 60 } }] } }), { status: 200 });
};
test('any valid Yahoo symbol is quoted live, no hard-coded catalogue needed', async () => {
 const previous = globalThis.fetch; const seen = []; const f = yahoo({ 'SU.PA': [230, 'EUR'], ZZTEST: [120, 'USD'], 'EURUSD=X': [1.2, 'USD'], 'BARC.L': [250, 'GBp'], 'EURGBP=X': [0.8, 'GBP'], '2330.TW': [1000, 'TWD'] });
 globalThis.fetch = async (url, init) => { seen.push(String(url)); return f(url, init); };
 try {
  const [eur] = await getQuotes(['SU.PA'], true);
  assert.equal(eur.assetId, 'SU.PA'); assert.equal(eur.nativePrice, 230); assert.equal(eur.eurPrice, 230); assert.equal(eur.source, 'yahoo-query2'); assert.equal(eur.freshness, 'fresh');
  const [usd] = await getQuotes(['ZZTEST'], true);
  assert.equal(usd.nativeCurrency, 'USD'); assert.equal(usd.eurPrice, 100, 'converted with the live EURUSD rate');
  const [gbp] = await getQuotes(['BARC.L'], true);
  assert.equal(gbp.nativeCurrency, 'GBP'); assert.equal(gbp.nativePrice, 2.5, 'pence normalized to pounds'); assert.equal(gbp.eurPrice, 3.125);
  const [twd] = await getQuotes(['2330.TW'], true);
  assert.equal(twd.nativePrice, 1000); assert.equal(twd.eurPrice, null, 'unsupported FX is reported, never guessed'); assert.ok(twd.warnings.includes('fx_TWD_unavailable'));
  seen.length = 0;
  const [bad] = await getQuotes(['../etc/passwd'], true);
  assert.equal(bad.freshness, 'unavailable'); assert.ok(bad.warnings.includes('unknown_asset')); assert.equal(seen.length, 0, 'invalid symbols never reach the network');
 } finally { globalThis.fetch = previous; }
});
