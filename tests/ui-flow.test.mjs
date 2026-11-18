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

test('adding a word already in the list opens its card for study', { skip, timeout: 25000 }, async () => {
  await withPage(async (page) => {
    await page.click('[data-view="add"]');
    await page.fill('#add-input', 'affordable');
    await page.click('#add-form button[type=submit]');
    await page.waitForSelector('#reveal');
    assert.equal((await page.textContent('.word')).trim(), 'affordable');
  });
});

test('study day rolls over when the app resumes the next morning', { skip, timeout: 60000 }, async () => {
  await withPage(async (page) => {
    for (let i = 0; i < 10; i++) {
      await page.click('#reveal');
      await page.click('[data-grade="good"]');
      await page.waitForSelector('#reveal, #more');
    }
    await page.waitForSelector('#more');
    await page.clock.setFixedTime(new Date(Date.now() + 10 * 3600 * 1000));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForSelector('#reveal', { timeout: 5000 });
  }, { clock: new Date(2026, 0, 5, 20, 0) });
});
