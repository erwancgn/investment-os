import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createResourceCache } from '../app/lib/resource-cache.ts';
import { documentPresentation } from '../app/lib/document-presentation.ts';
const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('simultaneous consumers and quick return reuse one request', async () => {
  let calls = 0;
  const cache = createResourceCache(async () => { calls++; return json({ value: 7 }); });
  await Promise.all([cache.read('/portfolio'), cache.read('/portfolio')]);
  await cache.read('/portfolio');
  assert.equal(calls, 1);
  assert.equal(cache.snapshot('/portfolio').data.value, 7);
});

test('failed refresh retains the previous data and retry clears the error', async () => {
  let fail = false;
  const cache = createResourceCache(async () => { if (fail) throw Error('offline'); return json({ value: 7 }); });
  await cache.read('/portfolio'); fail = true;
  await cache.read('/portfolio', true);
  assert.equal(cache.snapshot('/portfolio').data.value, 7);
  assert.equal(cache.snapshot('/portfolio').error, 'offline');
  fail = false; await cache.read('/portfolio', true);
  assert.equal(cache.snapshot('/portfolio').error, '');
});

test('background basket refresh keeps the cached snapshot until refresh=1 fails or completes', async () => {
  let fail = false; const urls = [];
  const cache = createResourceCache(async url => { urls.push(url); if (fail) throw Error('offline'); return json({ generatedAt: 'cached', selectedBasket: { returnPercent: 12 } }); });
  await cache.read('/api/theme-baskets?dimension=theme&period=1y');
  fail = true;
  await cache.read('/api/theme-baskets?dimension=theme&period=1y', true, true);
  const snapshot = cache.snapshot('/api/theme-baskets?dimension=theme&period=1y');
  assert.deepEqual(urls, ['/api/theme-baskets?dimension=theme&period=1y', '/api/theme-baskets?dimension=theme&period=1y&refresh=1']);
  assert.equal(snapshot.data.selectedBasket.returnPercent, 12, 'failed refresh leaves the dated D1 response visible');
  assert.equal(snapshot.error, 'offline');
});

test('Notion invalidation during a pending request discards the obsolete response', async () => {
  const pending = deferred(); let calls = 0;
  const cache = createResourceCache(async () => ++calls === 1 ? pending.promise : json({ revision: 2 }));
  const unsubscribe = cache.subscribe('/companies', () => {});
  const read = cache.read('/companies');
  await Promise.resolve(); cache.invalidate(); cache.refreshActive();
  await cache.read('/companies');
  assert.equal(cache.snapshot('/companies').data.revision, 2, 'fresh response must display before the obsolete request resolves');
  pending.resolve(json({ revision: 1 }));
  await read;
  unsubscribe();
  assert.equal(calls, 2);
  assert.equal(cache.snapshot('/companies').data.revision, 2);
});

test('manual quote refresh queued during a normal read keeps refresh=1', async () => {
  const pending = deferred(); const urls = [];
  const cache = createResourceCache(async url => { urls.push(url); return urls.length === 1 ? pending.promise : json({}); });
  const first = cache.read('/portfolio'); await Promise.resolve();
  const second = cache.read('/portfolio', true, true);
  pending.resolve(json({})); await Promise.all([first, second]);
  assert.deepEqual(urls, ['/portfolio', '/portfolio?refresh=1']);
});

test('session expiration clears all resources and ignores late old-session responses', async () => {
  const pending = deferred();
  const cache = createResourceCache(async url => url === '/late' ? pending.promise : url === '/expired' ? new Response('', { status: 401 }) : json({ private: true }));
  await cache.read('/known');
  const late = cache.read('/late'); await Promise.resolve();
  await cache.read('/expired'); pending.resolve(json({ private: true })); await late;
  for (const url of ['/known', '/late', '/expired']) assert.equal(cache.snapshot(url).data, undefined);
});

test('inactive views invalidate without eagerly refetching', async () => {
  let calls = 0;
  const cache = createResourceCache(async () => { calls++; return json({}); });
  await cache.read('/hidden'); cache.invalidate(); cache.refreshActive();
  assert.equal(calls, 1);
  await cache.read('/hidden'); assert.equal(calls, 2);
});

test('browser Notion client only reads public status', async () => {
  const bundled = await build({ entryPoints: ['app/lib/notion-sync-client.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { readBrowserNotionStatus } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    return json({ configured: true, sources: [] });
  };
  try {
    assert.deepEqual(await readBrowserNotionStatus(), { configured: true, sources: [] });
    assert.deepEqual(calls, ['/api/notion/status']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('missing Notion summary is safe', () => {
  assert.deepEqual(documentPresentation([], null).summaryItems, []);
});

test('company preview retains the exact late TLDR while removing full report bodies', async () => {
  const bundled = await build({ entryPoints: ['app/lib/company-preview.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { companyPreview } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const text = '# Detailed report\n\n' + 'Long research evidence. '.repeat(5000) + '\n\n## TL;DR\n\nThe original late summary must remain visible.\n\n## Appendix\n\nAppendix body.';
  const doc = { id: 'doc', title: 'Business report', plainText: text, category: 'business', summary: null, handoffSummary: null, current: true, archived: false };
  const company = { id: 'company', analyses: [doc], earnings: [], decisions: [], portfolioDocuments: [], archives: [] };
  const result = companyPreview(company);
  assert.deepEqual(result.analyses[0].previewSummaryItems, ['The original late summary must remain visible.']);
  assert.equal(result.analyses[0].plainText, '');
  assert.equal(doc.plainText, text, 'projection must not mutate the full document');
  assert.ok(JSON.stringify(result).length < JSON.stringify(company).length / 20);
});

test('service worker caches static assets only and never substitutes HTML for failed assets', async () => {
  const handlers = {}; const stored = new Map(); let calls = 0;
  const scope = {
    location: { origin: 'https://example.test' },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    clients: { claim: async () => {} }, skipWaiting() {},
  };
  vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: scope, URL,
    caches: { open: async () => ({ match: async req => stored.get(req.url), put: async (req, value) => stored.set(req.url, value) }) },
    fetch: async request => { calls++; if (request.url.endsWith('missing.js')) throw Error('offline'); if (request.url.endsWith('login.js')) return new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }); return new Response('export default 1', { headers: { 'content-type': 'text/javascript' } }); },
  });
  for (const path of ['/', '/api/portfolio/live', '/login', '/manifest.webmanifest']) {
    handlers.fetch({ request: new Request('https://example.test' + path), respondWith() { assert.fail('private or HTML request intercepted'); } });
  }
  const asset = () => new Promise(resolve => handlers.fetch({ request: new Request('https://example.test/assets/page-hash.js'), respondWith: resolve }));
  assert.equal((await asset()).status, 200); await asset(); assert.equal(calls, 1);
  const request = name => new Promise(resolve => handlers.fetch({ request: new Request('https://example.test/assets/' + name), respondWith: resolve }));
  await request('login.js');
  assert.equal(stored.has('https://example.test/assets/login.js'), false);
  await assert.rejects(request('missing.js'), /offline/);
});
