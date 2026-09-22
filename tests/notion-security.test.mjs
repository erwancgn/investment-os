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

test('manual document refresh is same-origin only and never needs the server sync secret in the browser', async () => {
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
  assert.equal(sameOrigin.status, 503);
  assert.doesNotMatch(await sameOrigin.text(), /NOTION_SYNC_AUTH_TOKEN|server-secret/);
});

test('refresh controls keep distinct responsibilities', async () => {
  const [documentRefresh, appRefresh, portfolioDashboard, pageSource] = await Promise.all([
    readFile(new URL('../app/components/notion-document-refresh.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/notion-global-refresh.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/live-portfolio-dashboard.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(documentRefresh, /requestBrowserNotionRefresh/);
  assert.doesNotMatch(documentRefresh, /serviceWorker|\/api\/portfolio\/live/);
  assert.match(appRefresh, /serviceWorker/);
  assert.doesNotMatch(appRefresh, /\/api\/notion\//);
  assert.match(pageSource, /Rafraîchir les cours et recalculer le portefeuille/);
  assert.doesNotMatch(portfolioDashboard, /requestBrowserNotionRefresh|serviceWorker/);
  assert.doesNotMatch(pageSource, /requestBrowserNotionRefresh|serviceWorker/);
});
