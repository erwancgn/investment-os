import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { readFile, writeFile, unlink } from 'node:fs/promises';

let apiPromise;
const api = () => apiPromise ??= build({ stdin: { contents: 'export * from "./adapters/notion/sync.ts";', resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' })
  .then(async result => { const path = `/tmp/investment-os-sources-test-${process.pid}.mjs`; await writeFile(path, result.outputFiles[0].text); try { return await import(`file://${path}`); } finally { await unlink(path); } });
const UUID = '11111111-2222-4333-8444-555555555555';

test('NOTION_SOURCES overrides one data source and leaves the others on their defaults', async () => {
  const { configureNotionSources, notionSources } = await api();
  const defaults = { ...configureNotionSources(undefined) };
  try {
    configureNotionSources(JSON.stringify({ companies: UUID.toUpperCase() }));
    assert.equal(notionSources.companies, UUID);
    assert.equal(notionSources.analyses, defaults.analyses);
    configureNotionSources('');
    assert.equal(notionSources.companies, defaults.companies, 'reconfiguring starts from the defaults again');
  } finally { configureNotionSources(undefined); }
});

test('NOTION_SOURCES fails closed on anything malformed instead of falling back to another database', async () => {
  const { configureNotionSources, notionSources } = await api();
  const before = notionSources.companies;
  for (const raw of ['{', '[]', '"x"', JSON.stringify({ nope: UUID }), JSON.stringify({ companies: 'not-a-uuid' }), JSON.stringify({ companies: 12 })])
    assert.throws(() => configureNotionSources(raw), /NOTION_SOURCES/, raw);
  assert.equal(notionSources.companies, before, 'a rejected value changes nothing');
});

async function portfolioDb() {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['0000_fat_the_spike.sql', '0001_notion_sync.sql', '0002_notion_sync_cursor.sql', '0003_notion_import_jobs.sql', '0004_damp_marrow.sql', '0005_curious_risque.sql', '0006_dazzling_maginty.sql'])
    sql.exec((await readFile(`drizzle/${file}`, 'utf8')).replaceAll('--> statement-breakpoint', ''));
  return { sql, db: { prepare(query) { const s = sql.prepare(query); let bindings = []; const stmt = { bind(...v) { bindings = v; return stmt; }, async all() { return { results: s.all(...bindings) }; }, async first() { return s.get(...bindings) ?? null; }, async run() { return { meta: { changes: Number(s.run(...bindings).changes) } }; } }; return stmt; }, async batch(statements) { return Promise.all(statements.map(s => s.run())); } } };
}
const row = n => ({ object: 'page', id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`, last_edited_time: '2026-10-06T10:00:00.000Z', url: `https://notion.so/p${n}`, parent: { data_source_id: 'c330cffb-8dbe-4051-92bf-1928eaa6312a' }, properties: {} });

test('the Portfolio sync follows Notion cursors past 100 rows instead of failing', async () => {
  const { syncNotionSource } = await api();
  const { sql, db } = await portfolioDb();
  const previous = globalThis.fetch; const cursors = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('c330cffb-8dbe-4051-92bf-1928eaa6312a')) return new Response(JSON.stringify({ results: [], has_more: false }), { status: 200 });
    const body = JSON.parse(init.body ?? '{}'); cursors.push(body.start_cursor ?? null);
    const first = !body.start_cursor, second = body.start_cursor === 'c1';
    const start = first ? 0 : second ? 100 : 200, count = first || second ? 100 : 20;
    return new Response(JSON.stringify({ results: Array.from({ length: count }, (_, i) => row(start + i + 1)), has_more: count === 100, next_cursor: first ? 'c1' : second ? 'c2' : null }), { status: 200 });
  };
  try {
    const result = await syncNotionSource(db, 'token', 'portfolio', 100, true);
    assert.equal(result.scanned, 220);
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM notion_documents WHERE source_key='portfolio'").get().n, 220);
    assert.deepEqual(cursors.slice(0, 3), [null, 'c1', 'c2']);
  } finally { globalThis.fetch = previous; }
});

test('a runaway cursor stops at the page cap with an explicit error', async () => {
  const { syncNotionSource } = await api();
  const { db } = await portfolioDb();
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ results: [row(calls)], has_more: true, next_cursor: `c${calls}` }), { status: 200 }); };
  try {
    await assert.rejects(() => syncNotionSource(db, 'token', 'portfolio', 100, true), /dépasse/);
    assert.ok(calls <= 21, `${calls} requests`);
  } finally { globalThis.fetch = previous; }
});
