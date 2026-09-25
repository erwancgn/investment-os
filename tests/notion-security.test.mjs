import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

let workerModule;

async function loadWorker() {
  if (workerModule) return workerModule;
  const result = await build({
    entryPoints: ['worker/index.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    plugins: [{
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
    }],
  });
  workerModule = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  return workerModule;
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
