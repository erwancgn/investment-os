import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createResourceCache } from '../app/lib/resource-cache.ts';
import { documentPresentation } from '../app/lib/document-presentation.ts';
const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function investmentDataFixture() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const bundle = await build({ entryPoints: [`${root}/app/lib/investment-data.ts`], bundle: true, write: false, platform: 'node', format: 'esm' });
  const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const previewBundle = await build({ entryPoints: [`${root}/app/lib/company-preview.ts`], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { companyPreview } = await import(`data:text/javascript;base64,${Buffer.from(previewBundle.outputFiles[0].text).toString('base64')}`);
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of (await readdir(`${root}/drizzle`)).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(await readFile(`${root}/drizzle/${migration}`, 'utf8'));
  sqlite.exec(`CREATE TABLE notion_document_companies (document_page_id TEXT NOT NULL, company_page_id TEXT NOT NULL, match_method TEXT NOT NULL, matched_at TEXT NOT NULL, PRIMARY KEY(document_page_id, company_page_id));
    CREATE TABLE notion_relations (source_page_id TEXT NOT NULL, source_key TEXT NOT NULL, property_name TEXT NOT NULL, target_page_id TEXT NOT NULL, target_source_key TEXT, matched_at TEXT NOT NULL, PRIMARY KEY(source_page_id, property_name, target_page_id));`);
  const reads = { bodyIds: new Set(), metadataLengths: [] };
  const db = { prepare(query) {
    const statement = sqlite.prepare(query); let bindings = [];
    const observe = rows => { for (const row of rows) { if (row.blocks_json) reads.bodyIds.add(row.page_id); else if (typeof row.plain_text === 'string') reads.metadataLengths.push(row.plain_text.length); } };
    const prepared = {
      bind(...values) { bindings = values; return prepared; },
      async all() { const results = statement.all(...bindings); observe(results); return { results }; },
      async first() { const result = statement.get(...bindings) ?? null; if (result) observe([result]); return result; },
      async run() { const result = statement.run(...bindings); return { success: true, meta: { changes: result.changes } }; },
    };
    return prepared;
  } };
  const rich = value => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });
  const relation = (...ids) => ({ type: 'relation', relation: ids.map(id => ({ id })) });
  const company = (id, name, pointers = {}) => {
    const properties = { Company: { type: 'title', title: [{ plain_text: name }] }, Ticker: rich(name.slice(0, 4).toUpperCase()), ...pointers };
    sqlite.prepare('INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)').run(id, 'companies', name, `https://notion.so/${id}`, '2026-09-30T10:00:00Z', JSON.stringify(properties), '[]', '', '2026-09-30T10:00:00Z');
  };
  const document = (id, title, source, properties, text, blocks) => sqlite.prepare('INSERT INTO notion_documents VALUES(?,?,?,?,?,?,?,?,?)').run(id, source, title, `https://notion.so/${id}`, '2026-09-29T10:00:00Z', JSON.stringify(properties), blocks, text, '2026-09-30T10:00:00Z');
  const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const current = 'a1111111-a111-4111-8111-a11111111111', archived = 'b2222222-b222-4222-8222-b22222222222';
  const memo = '33333333-3333-4333-8333-333333333333', decision = '44444444-4444-4444-8444-444444444444';
  const fallback = '55555555-5555-4555-8555-555555555555', unrelated = '66666666-6666-4666-8666-666666666666';
  const invalid = '77777777-7777-4777-8777-777777777777';
  const currentCompactUpper = current.replaceAll('-', '').toUpperCase();
  company(a, 'Alpha Systems', { 'Current Business Analysis': relation(current.replaceAll('-', '')), 'Current Investment Memo': relation(memo), 'Current Decision': relation(decision) });
  company(b, 'Beta Systems', { 'Current Business Analysis': relation(current) });
  const body = `Business thesis.\n${'Evidence and operating detail. '.repeat(120)}\n## TL;DR\n\nThe exact late summary is retained.\n## Historical evidence\n\nFull current body.`;
  const bodyBlock = text => JSON.stringify([{ id: 'p-1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: text }] } }]);
  const block = (id, type, text) => ({ id, type, [type]: { rich_text: [{ plain_text: text }] } });
  const currentBlocks = JSON.stringify([
    block('business-heading', 'heading_1', 'Business'),
    ...Array.from({ length: 12 }, (_, index) => block(`evidence-${index}`, 'paragraph', `Evidence ${index}: ${'Operating evidence remains available. '.repeat(10)}`)),
    block('summary-heading', 'heading_2', 'TL;DR'),
    block('summary-body', 'paragraph', 'The exact late summary is retained.'),
    block('history-heading', 'heading_2', 'Historical evidence'),
    block('history-body', 'paragraph', 'Full current body.'),
  ]);
  document(current, 'Alpha Business Analysis', 'analyses', { Company: relation(a, b), Agent: rich('Business Analyst'), Status: rich('Validated'), 'Source Freshness': rich('Current') }, body, currentBlocks);
  const oldHtml = '<h2>Business check archive</h2><p>Historical HTML remains complete.</p>';
  document(archived, 'Alpha Business Analysis Archived', 'analyses', { Company: relation(a), Agent: rich('Business Analyst'), Status: rich('Superseded') }, oldHtml, bodyBlock(oldHtml));
  document(memo, 'Alpha CIO Memo', 'analyses', { Company: relation(a), Agent: rich('Investment Memo'), Status: rich('Validated'), 'TL;DR': rich('CIO header summary stays available.') }, '## Decision\nKeep the memo.', bodyBlock('## Decision\nKeep the memo.'));
  document(decision, 'Alpha Investment Decision', 'decisions', { Company: relation(a), Status: rich('Validated') }, 'Action: Hold', bodyBlock('Action: Hold'));
  document(fallback, 'Alpha Unmapped Note', 'analyses', { Company: relation(a), Agent: rich('Future Unknown Agent') }, `Business model evidence ${'x'.repeat(560)} valuation language after first 500.`, bodyBlock(`Business model evidence ${'x'.repeat(560)} valuation language after first 500.`));
  const unrelatedBody = `Alpha Systems ${'unrelated large body. '.repeat(10000)}`;
  document(unrelated, 'Beta Research', 'analyses', { Company: relation(b), Agent: rich('Business Analyst') }, unrelatedBody, bodyBlock(unrelatedBody));
  document(invalid, 'Legacy HTML Snapshot', 'analyses', {}, '<div>Unparseable historical HTML remains visible.</div>', '{invalid json');
  sqlite.prepare('INSERT INTO notion_document_companies VALUES(?,?,?,?)').run(current, a, 'notion-relation', '2026-09-30T10:00:00Z');
  sqlite.prepare('INSERT INTO notion_document_companies VALUES(?,?,?,?)').run(current, b, 'notion-relation', '2026-09-30T10:00:00Z');
  sqlite.prepare('INSERT INTO notion_document_companies VALUES(?,?,?,?)').run(archived, a, 'notion-relation', '2026-09-30T10:00:00Z');
  sqlite.prepare('INSERT INTO notion_relations VALUES(?,?,?,?,?,?)').run(currentCompactUpper, 'analyses', 'Archive link', archived.replaceAll('-', '').toUpperCase(), 'analyses', '2026-09-30T10:00:00Z');
  sqlite.prepare('INSERT INTO notion_relations VALUES(?,?,?,?,?,?)').run(currentCompactUpper, 'analyses', 'Broken reference', '99999999999949998999999999999999', null, '2026-09-30T10:00:00Z');
  const clearReads = () => { reads.bodyIds.clear(); reads.metadataLengths.length = 0; };
  return { api, companyPreview, db, sqlite, reads, clearReads, ids: { a, b, current, archived, memo, decision, fallback, unrelated, invalid } };
}

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
  assert.equal(cache.snapshot('/portfolio').error, 'Connexion indisponible.');
  assert.equal(cache.snapshot('/portfolio').diagnostic.code, 'network');
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
  assert.equal(snapshot.error, 'Connexion indisponible.');
  assert.equal(snapshot.diagnostic.code, 'network');
});

test('basket manual refresh forces Yahoo without changing portfolio refresh URLs', async () => {
  const urls = [];
  const cache = createResourceCache(async url => { urls.push(url); return json({ ok: true }); });
  await cache.read('/api/theme-baskets?period=1y', true, 'force');
  await cache.read('/api/portfolio/live', true, true);
  assert.deepEqual(urls, ['/api/theme-baskets?period=1y&refresh=1&force=1', '/api/portfolio/live?refresh=1']);
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

test('company previews remain lightweight while their analysis ids resolve to complete demo documents', async () => {
  const bundled = await build({ entryPoints: ['app/lib/company-preview.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { companyPreview } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const { getDemoCompanyDetail, getDemoResearchDocument } = await import('../app/lib/demo-data.ts');
  const company = companyPreview(getDemoCompanyDetail('demo-lumagrid').company);
  for (const preview of company.analyses) {
    assert.equal(preview.plainText, '');
    const full = getDemoResearchDocument(preview.id)?.document;
    assert.ok(full?.plainText.length > 0, `full document missing for ${preview.id}`);
    assert.equal(full.id, preview.id);
  }
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

test('D1 company and document reads load only scoped report bodies and preserve legacy selection', async () => {
  const fixture = await investmentDataFixture();
  const { api, companyPreview, db, sqlite, reads, clearReads, ids } = fixture;
  const compact = ids.current.replaceAll('-', '');
  try {
    await api.listCompanies(db, true);
    assert.deepEqual([...reads.bodyIds], [], 'company-list references use bounded metadata, not report blocks');
    assert.ok(reads.metadataLengths.every(length => length <= 500), 'global classification text is capped at the existing 500-character rule');

    clearReads();
    const listed = await api.listResearchDocuments(db);
    assert.deepEqual([...reads.bodyIds], [], 'the default integrity/list projection omits full block JSON');
    assert.ok(reads.metadataLengths.every(length => length <= 700), 'default document-list text remains the existing 700-character summary window');
    assert.equal(listed.find(document => document.id === ids.memo).summary, 'CIO header summary stays available.');

    clearReads();
    const detail = await api.getCompanyDetail(db, ids.a.replaceAll('-', ''));
    const loadedForCompany = [...reads.bodyIds].sort();
    assert.deepEqual(loadedForCompany, [ids.archived, ids.current, ids.decision, ids.fallback, ids.memo].sort(), 'full bodies are hydrated for the company current/history candidates only');
    assert.equal(detail.analyses.find(document => document.id === ids.current).category, 'business');
    assert.ok(detail.archives.some(document => document.id === ids.archived));
    assert.ok(detail.archives.some(document => document.id === ids.fallback), 'unknown Agent still uses the first 500 body characters for legacy categorization');
    assert.ok(detail.analyses.some(document => document.id === ids.memo));
    assert.ok(detail.decisions.some(document => document.id === ids.decision), 'the CIO memo and Notion decision stay separate');
    const current = detail.analyses.find(document => document.id === ids.current);
    assert.equal(current.current, true);
    assert.match(JSON.stringify(current.normalizedAnalysis.analysis.content), /The exact late summary is retained/);
    assert.match(JSON.stringify(detail.archives.find(document => document.id === ids.archived).normalizedAnalysis.analysis.content), /Historical HTML remains complete/);
    const preview = companyPreview(detail).analyses.find(document => document.id === ids.current);
    assert.deepEqual(preview.previewSummaryItems, ['The exact late summary is retained.']);
    assert.equal(preview.plainText, '');

    clearReads();
    const full = await api.getResearchDocument(db, compact);
    assert.deepEqual([...reads.bodyIds], [ids.current], 'compact-ID fallback hydrates exactly the selected dashed-ID row');
    assert.equal(full.id, ids.current);
    assert.equal(full.companyName, 'Alpha Systems, Beta Systems', 'many-owner Current metadata is preserved');
    assert.equal(full.relations.find(relation => relation.property === 'Archive link')?.title, 'Alpha Business Analysis Archived', 'compact uppercase relation targets resolve to dashed stored IDs');
    assert.equal(full.relations.find(relation => relation.property === 'Broken reference')?.title, 'Page Notion', 'missing relation targets retain the safe fallback');
    assert.match(JSON.stringify(full.normalizedAnalysis.analysis.content), /Full current body/);
  } finally { sqlite.close(); }
});

test('integrity presentation reads retain complete block and projection diagnostics', async () => {
  const fixture = await investmentDataFixture();
  try {
    const docs = await fixture.api.listResearchDocuments(fixture.db, true);
    assert.deepEqual([...fixture.reads.bodyIds].sort(), [fixture.ids.archived, fixture.ids.current, fixture.ids.decision, fixture.ids.fallback, fixture.ids.memo, fixture.ids.unrelated, fixture.ids.invalid].sort());
    assert.ok(docs.every(document => document.normalizedAnalysis?.analysis.content.blocks.length >= 0));
    assert.ok(docs.some(document => document.presentationStatus === 'absent'));
    assert.ok(docs.some(document => document.presentationStatus === 'invalid'));
    const archiveContent = docs.find(document => document.id === fixture.ids.archived).normalizedAnalysis.analysis.content;
    assert.match(JSON.stringify(archiveContent), /Historical HTML remains complete/, 'integrity normalization preserves the complete historical HTML content');
  } finally { fixture.sqlite.close(); }
});
