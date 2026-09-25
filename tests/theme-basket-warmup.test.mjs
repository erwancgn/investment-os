import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('basket warm-up is single-flight, waits for portfolio refresh and walks quote batches', async () => {
  const bundle = await build({ entryPoints: ['app/lib/theme-basket-warmup.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { createThemeBasketWarmup } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  let busy = true;
  const urls = [];
  let defaultRefreshes = 0;
  const fetcher = async url => {
    urls.push(url);
    if (url === '/api/theme-baskets?dimension=theme&period=1y') return Response.json({ refreshNeeded: true });
    const batch = Number(new URL('https://local' + url).searchParams.get('batch'));
    return Response.json({ refreshProgress: batch === 0
      ? { nextBatch: 1, totalBatches: 2, complete: false }
      : { nextBatch: 2, totalBatches: 2, complete: true } });
  };
  const warm = createThemeBasketWarmup({
    fetcher,
    isVisible: () => true,
    portfolioBusy: () => busy,
    wait: async () => { busy = false; },
    waitForVisible: async () => {},
    refreshDefault: async () => { defaultRefreshes++; },
  });
  const first = warm();
  const second = warm();
  assert.strictEqual(first, second, 'concurrent callers share the same in-flight batch loop');
  await first;
  assert.deepEqual(urls.map(url => url.includes('refresh=1') ? new URL('https://local' + url).searchParams.get('batch') : 'read'), ['read', '0', '1']);
  assert.ok(urls.every(url => !url.includes('/api/portfolio/')), 'the basket worker never routes through the portfolio quote endpoint');
  assert.equal(defaultRefreshes, 1, 'the browser resource is refreshed once after all batches publish');
});
