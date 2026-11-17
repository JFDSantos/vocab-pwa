import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { /* playwright not installed */ }

function serve() {
  const server = http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, url: `http://localhost:${server.address().port}/` })));
}

test('manifest has relative start_url and scope "./"', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512'));
  for (const i of m.icons) assert.ok(existsSync(join(ROOT, i.src)), `${i.src} exists`);
});

test('index.html links manifest and apple-touch-icon and apple-mobile-web-app-capable', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.ok(existsSync(join(ROOT, 'icons/apple-touch-icon.png')));
});

test('after first load, going offline still renders the study screen', { skip: !chromium && 'playwright not installed', timeout: 25000 }, async () => {
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForSelector('#reveal');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('#reveal', { timeout: 5000 });
  } finally {
    await browser.close();
    server.close();
  }
});

test('dictionary API requests are not cached', { skip: !chromium && 'playwright not installed', timeout: 25000 }, async () => {
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector('#reveal');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    const api = 'https://api.dictionaryapi.dev/api/v2/entries/en/test';
    await page.evaluate((u) => fetch(u).catch(() => {}), api);
    const cached = await page.evaluate(async (u) => Boolean(await caches.match(u)), api);
    assert.equal(cached, false);
  } finally {
    await browser.close();
    server.close();
  }
});
