import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, serve } from './helpers.mjs';

const skip = !chromium && 'playwright not installed';

async function withPage(fn, { clock } = {}) {
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    if (clock) await page.clock.install({ time: clock });
    await page.goto(url);
    await page.waitForSelector('#reveal');
    await fn(page);
  } finally {
    await browser.close();
    server.close();
  }
}

test('grade buttons are hidden until the answer is revealed', { skip, timeout: 25000 }, async () => {
  await withPage(async (page) => {
    assert.equal(await page.isVisible('#grades'), false);
    assert.equal(await page.isVisible('#back'), false);
    await page.click('#reveal');
    assert.equal(await page.isVisible('#grades'), true);
  });
});
