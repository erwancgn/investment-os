import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

let workerModule;
let normalizerFailureWorkerModule;

async function loadWorker({ stubNormalizer = false } = {}) {
  if (stubNormalizer && normalizerFailureWorkerModule) return normalizerFailureWorkerModule;
  if (!stubNormalizer && workerModule) return workerModule;
  const plugins = [{
    name: 'stub-vinext-rsc-entry',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^virtual:vinext-rsc-entry$/ }, () => ({
        path: 'vinext-rsc-entry',
        namespace: 'test-stub',
      }));
      buildContext.onLoad({ filter: /.*/, namespace: 'test-stub' }, () => ({
        contents: 'export default {};',
        loader: 'js',
      }));
    },
  }];
  if (stubNormalizer) {
    plugins.push({
      name: 'stub-analysis-normalizer',
      setup(buildContext) {
        buildContext.onResolve({ filter: /(?:^\.\/|^\.\.\/\.\.\/app\/lib\/)document-presentation$/ }, () => ({
          path: 'document-presentation-stub',
          namespace: 'normalizer-stub',
        }));
        buildContext.onLoad({ filter: /.*/, namespace: 'normalizer-stub' }, () => ({
          contents: 'export function normalizeAnalysisDocument() { throw new Error("private normalizer detail"); }',
          loader: 'js',
        }));
      },
    });
  }
  const result = await build({
    entryPoints: ['worker/index.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    plugins,
  });
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  if (stubNormalizer) normalizerFailureWorkerModule = loaded;
  else workerModule = loaded;
  return loaded;
}

const mutationPaths = [
  '/api/notion/sync',
  '/api/notion/import-next',
  '/api/notion/sync-background',
  '/api/notion/sync-portfolio',
  '/api/notion/sync-all',
];

test('all Notion mutation routes reject anonymous browser requests', async () => {
  const { default: worker } = await loadWorker();
  for (const path of mutationPaths) {
    const response = await worker.fetch(
      new Request(`https://investment-os.test${path}`, { method: 'POST' }),
      { NOTION_SYNC_AUTH_TOKEN: 'server-secret' },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 401, path);
    assert.doesNotMatch(await response.text(), /server-secret|NOTION_TOKEN/);
  }
});

test('anonymous callers always use the demo scope, even with a forged personal cookie', async () => {
  const { default: worker } = await loadWorker();
  const db = new Proxy({}, { get() { throw new Error('private D1 access attempted'); } });
  const env = { DB: db };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const session = await worker.fetch(new Request('https://investment-os.test/api/session', {
    headers: { cookie: 'investment-os-scope=personal' },
  }), env, ctx);
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { scope: 'demo', canAccessPersonal: false });

  const personalSelection = await worker.fetch(new Request('https://investment-os.test/api/session', {
    method: 'POST',
    headers: { origin: 'https://investment-os.test', 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'personal' }),
  }), env, ctx);
  assert.equal(personalSelection.status, 403);
  assert.doesNotMatch(await personalSelection.text(), /owner@|personal/);

  const portfolio = await worker.fetch(new Request('https://investment-os.test/api/portfolio/live', {
    headers: { cookie: 'investment-os-scope=personal' },
  }), env, ctx);
  assert.equal(portfolio.status, 200);
  const portfolioBody = await portfolio.json();
  assert.ok(portfolioBody.positions.every(position => position.id.startsWith('demo-')));
  assert.doesNotMatch(JSON.stringify(portfolioBody), /notion\.so\/[0-9a-f-]{32,}/i);

  const privateId = await worker.fetch(new Request('https://investment-os.test/api/analyses/known-private-page-id', {
    headers: { cookie: 'investment-os-scope=personal' },
  }), env, ctx);
  assert.equal(privateId.status, 404);
  assert.doesNotMatch(await privateId.text(), /known-private-page-id/);

  const status = await worker.fetch(new Request('https://investment-os.test/api/notion/status', {
    headers: { cookie: 'investment-os-scope=personal' },
  }), env, ctx);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { configured: false });

  const refresh = await worker.fetch(new Request('https://investment-os.test/api/notion/refresh', {
    method: 'POST',
    headers: { origin: 'https://investment-os.test', 'sec-fetch-site': 'same-origin', 'x-investment-os-action': 'notion-refresh', cookie: 'investment-os-scope=personal' },
  }), env, ctx);
  assert.equal(refresh.status, 403);

  const quotes = await worker.fetch(new Request('https://investment-os.test/api/quotes?assets=nvda', {
    headers: { cookie: 'investment-os-scope=personal' },
  }), env, ctx);
  assert.equal(quotes.status, 403);
});

test('owner identity comes only from the Sites authenticated email header plus server configuration', async () => {
  const { default: worker } = await loadWorker();
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const request = new Request('https://investment-os.test/api/session', {
    headers: { 'oai-authenticated-user-email': ' Owner@Example.Test ' },
  });

  const untrustedHeaderOnly = await worker.fetch(new Request('https://investment-os.test/api/session', {
    headers: { 'x-forwarded-email': 'owner@example.test', cookie: 'investment-os-scope=personal' },
  }), { OWNER_EMAIL: 'owner@example.test' }, ctx);
  assert.deepEqual(await untrustedHeaderOnly.json(), { scope: 'demo', canAccessPersonal: false });

  const configured = await worker.fetch(request, { OWNER_EMAIL: 'owner@example.test' }, ctx);
  assert.deepEqual(await configured.json(), { scope: 'demo', canAccessPersonal: true });

  const explicitlyPersonal = await worker.fetch(new Request('https://investment-os.test/api/session', {
    headers: {
      'oai-authenticated-user-email': 'owner@example.test',
      cookie: 'investment-os-scope=personal',
    },
  }), { OWNER_EMAIL: 'owner@example.test' }, ctx);
  assert.deepEqual(await explicitlyPersonal.json(), { scope: 'personal', canAccessPersonal: true });

  const mismatched = await worker.fetch(request, { OWNER_EMAIL: 'someone-else@example.test' }, ctx);
  assert.deepEqual(await mismatched.json(), { scope: 'demo', canAccessPersonal: false });
});

test('image optimizer cannot proxy API routes or arbitrary static paths', async () => {
  const { default: worker } = await loadWorker();
  let assetFetches = 0;
  const response = await worker.fetch(new Request('https://investment-os.test/_vinext/image?url=%2Fapi%2Fportfolio%2Flive&w=640&q=75'), {
    ASSETS: { fetch: async () => { assetFetches += 1; return new Response('private'); } },
    IMAGES: { input() { throw new Error('image transform must not run'); } },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 404);
  assert.equal(assetFetches, 0);
});

test('owner must explicitly select personal scope and the preference is an HttpOnly cookie', async () => {
  const { default: worker } = await loadWorker();
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const response = await worker.fetch(new Request('https://investment-os.test/api/session', {
    method: 'POST',
    headers: {
      origin: 'https://investment-os.test',
      'content-type': 'application/json',
      'oai-authenticated-user-email': 'owner@example.test',
    },
    body: JSON.stringify({ scope: 'personal' }),
  }), { OWNER_EMAIL: 'owner@example.test' }, ctx);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), 'investment-os-scope=personal; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000');
  assert.deepEqual(await response.json(), { scope: 'personal', canAccessPersonal: true });
});

test('all Notion mutation routes reject an incorrect bearer token', async () => {
  const { default: worker } = await loadWorker();
  for (const path of mutationPaths) {
    const response = await worker.fetch(
      new Request(`https://investment-os.test${path}`, {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
      }),
      { NOTION_SYNC_AUTH_TOKEN: 'server-secret' },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 401, path);
    assert.doesNotMatch(await response.text(), /server-secret|NOTION_TOKEN/);
  }
});

test('mutation routes fail closed when the server authorization secret is not configured', async () => {
  const { default: worker } = await loadWorker();
  for (const path of mutationPaths) {
    const response = await worker.fetch(
      new Request(`https://investment-os.test${path}`, { method: 'POST' }),
      {},
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 503, path);
    assert.doesNotMatch(await response.text(), /verificationToken|secret-token|NOTION_TOKEN/);
  }
});

test('a server bearer token passes the auth gate before route validation', async () => {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(
    new Request('https://investment-os.test/api/notion/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer server-secret', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    { NOTION_SYNC_AUTH_TOKEN: 'server-secret', NOTION_TOKEN: 'notion-token' },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /Source Notion invalide/);
});

test('webhook verification never exposes its stored token', async () => {
  const { default: worker } = await loadWorker();
  const response = await worker.fetch(
    new Request('https://investment-os.test/api/notion/webhook-verification'),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 410);
  assert.doesNotMatch(await response.text(), /verificationToken|secret-token/);
});

test('signed Notion webhook payloads remain verifiable', async () => {
  const { verifyNotionWebhookSignature } = await loadWorker();
  const body = JSON.stringify({ id: 'event-1', type: 'page.updated' });
  const secret = 'webhook-secret';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const signature = `sha256=${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  assert.equal(await verifyNotionWebhookSignature(body, signature, secret), true);
  assert.equal(await verifyNotionWebhookSignature(body, `${signature}00`, secret), false);
});

test('browser Notion surfaces never expose server mutation secrets or internal sync routes', async () => {
  const files = [
    'app/page.tsx',
    'app/components/notion-background-sync.tsx',
    'app/components/notion-sync-status.tsx',
    'app/components/notion-document-refresh.tsx',
    'app/lib/notion-sync-client.ts',
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /NOTION_SYNC_AUTH_TOKEN|NOTION_TOKEN|verificationToken/);
    assert.doesNotMatch(source, /\/api\/notion\/(?:sync|import-next|sync-background|sync-portfolio|sync-all)/);
  }
  const client = await readFile(new URL('../app/lib/notion-sync-client.ts', import.meta.url), 'utf8');
  assert.match(client, /fetch\(["']\/api\/notion\/refresh["']/);
  assert.match(client, /x-investment-os-action["']:\s*["']notion-refresh/);
});

test('manual document refresh requires owner scope and remains same-origin only', async () => {
  const { default: worker } = await loadWorker();
  const crossOrigin = await worker.fetch(
    new Request('https://investment-os.test/api/notion/refresh', {
      method: 'POST',
      headers: { origin: 'https://example.test', 'sec-fetch-site': 'cross-site', 'x-investment-os-action': 'notion-refresh' },
    }),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(crossOrigin.status, 403);

  const missingAction = await worker.fetch(
    new Request('https://investment-os.test/api/notion/refresh', {
      method: 'POST',
      headers: { origin: 'https://investment-os.test', 'sec-fetch-site': 'same-origin' },
    }),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(missingAction.status, 403);

  const sameOrigin = await worker.fetch(
    new Request('https://investment-os.test/api/notion/refresh', {
      method: 'POST',
      headers: { origin: 'https://investment-os.test', 'sec-fetch-site': 'same-origin', 'x-investment-os-action': 'notion-refresh' },
    }),
    {},
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(sameOrigin.status, 403);
  assert.doesNotMatch(await sameOrigin.text(), /NOTION_SYNC_AUTH_TOKEN|server-secret/);
});

test('refresh controls keep distinct responsibilities', async () => {
  const [documentRefresh, appRefresh, portfolioDashboard, portfolioHeader, pageSource] = await Promise.all([
    readFile(new URL('../app/components/notion-document-refresh.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/notion-global-refresh.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/live-portfolio-dashboard.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/app-page-header.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(documentRefresh, /requestBrowserNotionRefresh/);
  assert.doesNotMatch(documentRefresh, /serviceWorker|\/api\/portfolio\/live/);
  assert.match(appRefresh, /serviceWorker/);
  assert.doesNotMatch(appRefresh, /\/api\/notion\//);
  assert.match(portfolioHeader, /Rafraîchir les cours et recalculer le portefeuille/);
  assert.match(pageSource, /PortfolioPageHeader/);
  assert.doesNotMatch(portfolioDashboard, /requestBrowserNotionRefresh|serviceWorker/);
  assert.doesNotMatch(pageSource, /requestBrowserNotionRefresh|serviceWorker/);
});

test('private analysis storage failures return a safe correlated diagnostic', async () => {
  const { default: worker } = await loadWorker();
  const db = new Proxy({}, { get(_target, key) { if (key === 'prepare') return () => { throw new Error('private SQL and credentials'); }; } });
  const previousError = console.error;
  const logs = [];
  console.error = value => logs.push(String(value));
  let response;
  let timeoutResponse;
  try {
    response = await worker.fetch(new Request('https://investment-os.test/api/analyses/private-page-id', {
      headers: { cookie: 'investment-os-scope=personal', 'oai-authenticated-user-email': 'owner@example.test' },
    }), { OWNER_EMAIL: 'owner@example.test', DB: db }, { waitUntil() {}, passThroughOnException() {} });
    const timeoutDb = new Proxy({}, { get(_target, key) { if (key === 'prepare') return () => { throw new DOMException('private timeout detail', 'TimeoutError'); }; } });
    timeoutResponse = await worker.fetch(new Request('https://investment-os.test/api/analyses/timeout-page-id', {
      headers: { cookie: 'investment-os-scope=personal', 'oai-authenticated-user-email': 'owner@example.test' },
    }), { OWNER_EMAIL: 'owner@example.test', DB: timeoutDb }, { waitUntil() {}, passThroughOnException() {} });
  } finally {
    console.error = previousError;
  }
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.code, 'storage');
  assert.equal(body.stage, 'read');
  assert.equal(body.requestId, response.headers.get('x-request-id'));
  assert.match(response.headers.get('server-timing'), /^app;dur=/);
  assert.doesNotMatch(JSON.stringify(body), /private SQL|credentials|private-page-id/);
  assert.equal(timeoutResponse.status, 500);
  const timeoutBody = await timeoutResponse.json();
  assert.equal(timeoutBody.code, 'timeout');
  assert.equal(timeoutBody.stage, 'read');
  assert.equal(timeoutBody.requestId, timeoutResponse.headers.get('x-request-id'));
  assert.doesNotMatch(JSON.stringify(timeoutBody), /private timeout detail|timeout-page-id/);
  assert.equal(logs.length, 2);
  assert.doesNotMatch(logs.join('\n'), /private SQL|credentials|private timeout detail/);
  const log = JSON.parse(logs[0]);
  assert.deepEqual(Object.keys(log).sort(), ['code', 'durationMs', 'event', 'id', 'stage']);
  assert.equal(log.event, 'analysis-read-failed');
  assert.equal(log.id, body.requestId);
  assert.equal(log.code, body.code);
  assert.equal(log.stage, body.stage);
  assert.equal(typeof log.durationMs, 'number');
  const timeoutLog = JSON.parse(logs[1]);
  assert.equal(timeoutLog.code, 'timeout');
  assert.equal(timeoutLog.id, timeoutBody.requestId);
});

test('normalizer exceptions are tagged safely at the document mapping boundary', async () => {
  const { default: worker } = await loadWorker({ stubNormalizer: true });
  const analysisRow = {
    page_id: 'normalizer-page-id', source_key: 'analyses', title: 'Business document',
    notion_url: 'https://www.notion.so/normalizer-page-id', last_edited_time: '2026-09-30T10:00:00.000Z',
    plain_text: 'Business source body', properties_json: '{}', blocks_json: '[]',
  };
  const db = {
    prepare(sql) {
      const statement = {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() { return sql.includes('WHERE page_id=?') ? analysisRow : null; },
        async all() {
          if (sql.includes('FROM notion_document_companies')) return { results: [] };
          if (sql.includes('FROM notion_relations')) return { results: [] };
          if (sql.includes("source_key='companies'")) return { results: [] };
          if (sql.includes("source_key='portfolio'")) return { results: [] };
          if (sql.includes("source_key='watchlist'")) return { results: [] };
          if (sql.includes("source_key IN ('analyses','earnings','decisions','portfolio')")) return { results: [analysisRow] };
          return { results: [] };
        },
        async run() { return { success: true }; },
      };
      return statement;
    },
  };
  const previousError = console.error;
  const logs = [];
  console.error = value => logs.push(String(value));
  let response;
  try {
    response = await worker.fetch(new Request('https://investment-os.test/api/analyses/normalizer-page-id', {
      headers: { cookie: 'investment-os-scope=personal', 'oai-authenticated-user-email': 'owner@example.test' },
    }), { OWNER_EMAIL: 'owner@example.test', DB: db }, { waitUntil() {}, passThroughOnException() {} });
  } finally {
    console.error = previousError;
  }
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.code, 'normalization');
  assert.equal(body.stage, 'normalization');
  assert.equal(body.requestId, response.headers.get('x-request-id'));
  assert.doesNotMatch(JSON.stringify(body), /private normalizer detail|normalizer-page-id/);
  assert.equal(logs.length, 1);
  const log = JSON.parse(logs[0]);
  assert.equal(log.code, 'normalization');
  assert.equal(log.stage, 'normalization');
  assert.doesNotMatch(logs[0], /private normalizer detail/);
});
