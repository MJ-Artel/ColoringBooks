// Browser smoke test for the website and the Colouring Studio. Serves the built site (dist/) under the
// GitHub Pages path, checks every page and internal link, colours pages with every tool on a desktop,
// a tablet and a phone (with real touch input), checks autosave, downloads and the region-aware Amazon
// buttons, and writes screenshots.
//   npm run build && npm run smoke [-- --out <dir>] [-- --base https://mjartel.fyi]
// --base tests a deployed copy instead of dist/.
// Needs Playwright with Chromium (`npx playwright install chromium`), or PLAYWRIGHT_MODULE pointing at an install.

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const out = arg('--out') ?? join(root, 'test-output');
const BASE_PATH = '';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain',
};
const dist = join(root, 'dist');
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const path = url.startsWith(`${BASE_PATH}/`) ? normalize(url.slice(BASE_PATH.length)).replace(/^(\.\.[/\\])+/, '') : null;
  try {
    if (path === null) throw new Error('outside the site');
    const file = join(dist, path.endsWith('/') ? `${path}index.html` : path);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html' }).end(await readFile(join(dist, '404.html')).catch(() => 'not found'));
  }
});
let base = arg('--base')?.replace(/\/$/, '');
if (!base) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}${BASE_PATH}`;
}
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const failures = [];
const check = (ok, what) => (ok ? console.log(`ok   ${what}`) : (failures.push(what), console.log(`FAIL ${what}`)));

async function open(options, hash) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} (${m.location().url})`));
  page.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  await page.goto(`${base}/color/#${hash}`);
  await page.waitForSelector('body[data-ready]', { timeout: 15000 });
  console.log(`     ${hash} ready in ${Date.now() - t0} ms`);
  return { context, page };
}

const inked = (page) => page.evaluate(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const c = document.getElementById('paint');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let j = 3; j < d.length; j += 4) if (d[j]) n++;
  return n;
});

async function stroke(page, box, pts) {
  const at = ([fx, fy]) => [box.x + fx * box.width, box.y + fy * box.height];
  const [x0, y0] = at(pts[0]);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (const p of pts.slice(1)) {
    const [x, y] = at(p);
    await page.mouse.move(x, y, { steps: 6 });
  }
  await page.mouse.up();
}

// Full-page screenshot after scrolling, so lazy-loaded images further down have loaded.
async function fullShot(page, path) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path, fullPage: true });
}

const zigzag = (y, h = 0.035) => Array.from({ length: 9 }, (_, i) => [0.1 + i * 0.1, y + (i % 2 ? h : -h)]);

// Desktop: one band per tool, lines off so the media show side by side.
{
  const { context, page } = await open({ viewport: { width: 1440, height: 900 } }, 'wildwood-29');
  const box = await page.locator('#sheet').boundingBox();
  await page.locator('.tool[data-tool="fill"]').click();
  await page.locator('#swatches .swatch').nth(19).click();
  await page.mouse.click(box.x + box.width * 0.02, box.y + box.height * 0.98);
  await page.keyboard.press('l');
  const tools = ['pencil', 'crayon', 'watercolour', 'marker', 'alcohol', 'glitter', 'graphite'];
  const colours = [8, 12, 5, 16, 1, 15, 0];
  for (const [i, tool] of tools.entries()) {
    await page.locator(`.tool[data-tool="${tool}"]`).click();
    await page.locator('#swatches .swatch').nth(colours[i]).click();
    await page.locator(`.tool[data-tool="${tool}"]`).click();
    const y = 0.1 + i * 0.12;
    await stroke(page, box, zigzag(y));
    if (tool === 'alcohol') await stroke(page, box, zigzag(y + 0.02).reverse());
  }
  await page.locator('.tool[data-tool="eraser"]').click();
  await stroke(page, box, [[0.5, 0.05], [0.5, 0.95]]);
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, 'studio-desktop.png') });
  await page.locator('.tool[data-tool="fill"]').click();
  await page.locator('#swatches .swatch').nth(10).click();
  await page.mouse.click(box.x + box.width * 0.36, box.y + box.height * 0.27);
  const n = await inked(page);
  check(n > 50000, `desktop page has colour (${n} px)`);

  const download = page.waitForEvent('download');
  await page.locator('.text-btn[data-action="save"]').click();
  const file = await download;
  await file.saveAs(join(out, 'saved-picture.png'));
  check(true, `picture download (${file.suggestedFilename()})`);

  await page.locator('[data-action="undo"]').first().click();
  check((await inked(page)) < n, 'undo removes the fill');
  await page.locator('[data-action="redo"]').first().click();
  check((await inked(page)) === n, 'redo brings it back');

  await page.waitForTimeout(1600); // autosave
  await page.reload();
  await page.waitForSelector('body[data-ready]');
  check((await inked(page)) > 50000, 'autosave restores the page after a reload');

  await page.locator('.page-btn').click();
  await page.waitForSelector('#picker[open]');
  await page.screenshot({ path: join(out, 'picker-desktop.png') });
  check((await page.locator('.picker-page').count()) === 16, 'picker lists 16 pages');
  check((await page.locator('.picker-page .badge').count()) >= 1, 'picker marks pages in progress');
  await page.locator('.picker-page', { hasText: 'Meet Scribbles' }).click();
  await page.waitForFunction(() => document.body.dataset.ready === 'robot-3');
  check(page.url().endsWith('#robot-3'), 'choosing a page updates the address');
  await context.close();
}

// A neat page the way a visitor would colour it: lines on, fills and brushes.
{
  const { context, page } = await open({ viewport: { width: 1280, height: 860 } }, 'wildwood-73');
  const box = await page.locator('#sheet').boundingBox();
  const fillWith = async (look, swatch, points) => {
    await page.locator('.tool[data-tool="fill"]').click();
    await page.locator(`.chip[data-look="${look}"]`).click();
    await page.locator('#swatches .swatch').nth(swatch).click();
    for (const [fx, fy] of points) await page.mouse.click(box.x + fx * box.width, box.y + fy * box.height);
  };
  await fillWith('watercolour', 10, [[0.5, 0.33], [0.5, 0.5]]);
  await fillWith('flat', 13, [[0.5, 0.86]]);
  await fillWith('crayon', 4, [[0.05, 0.05]]);
  await page.locator('.tool[data-tool="glitter"]').click();
  await page.locator('#swatches .swatch').nth(11).click();
  await stroke(page, box, [[0.38, 0.2], [0.45, 0.25], [0.55, 0.2], [0.62, 0.25]]);
  await page.screenshot({ path: join(out, 'studio-trophy.png') });
  await context.close();
}

// Phone: layout, page picker, a finger stroke.
{
  const { context, page } = await open(
    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'robot-3');
  await page.screenshot({ path: join(out, 'studio-phone.png') });
  const box = await page.locator('#sheet').boundingBox();
  check(box.width > 300, `phone page is a usable size (${Math.round(box.width)} px wide)`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, 'no sideways scrolling on a phone');

  // Real touch input: one finger colours, two fingers zoom without leaving a mark.
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await touch('touchStart', [{ x: cx - 100, y: cy, id: 1 }]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: cx - 100 + i * 20, y: cy + (i % 2) * 10, id: 1 }]);
  await touch('touchEnd', []);
  const afterFinger = await inked(page);
  check(afterFinger > 500, `one finger colours (${afterFinger} px)`);
  const scale = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('sheet')).transform).a);
  const before = await scale();
  await touch('touchStart', [{ x: cx - 40, y: cy - 60, id: 1 }, { x: cx + 40, y: cy - 60, id: 2 }]);
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', [{ x: cx - 40 - i * 8, y: cy - 60, id: 1 }, { x: cx + 40 + i * 8, y: cy - 60, id: 2 }]);
  }
  await touch('touchEnd', []);
  const after = await scale();
  check(after > before * 1.5, `pinch zooms in (${before.toFixed(2)} -> ${after.toFixed(2)})`);
  check((await inked(page)) === afterFinger, 'pinching leaves no mark');
  await page.screenshot({ path: join(out, 'studio-phone-zoomed.png') });
  await page.locator('.page-btn').click();
  await page.waitForSelector('#picker[open]');
  await page.screenshot({ path: join(out, 'picker-phone.png') });
  await context.close();
}

// Tablet portrait.
{
  const { context, page } = await open(
    { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'cars-5');
  await page.screenshot({ path: join(out, 'studio-tablet.png') });
  await context.close();
}

// Home page: visitors colour the fox right there, and the Studio opens the picture as they left it.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} (${m.location().url})`));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/`);
  await page.waitForSelector('[data-colour-me].is-live', { timeout: 15000 });
  const coloured = () => page.evaluate(() => {
    const c = document.querySelector('[data-colour-me] canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let j = 3; j < d.length; j += 4) if (d[j]) n++;
    return n;
  });
  const before = await coloured();
  check(before > 10000, `the home page fox starts partly coloured (${before} px)`);
  await page.locator('[data-crayon="#e5432f"]').click();
  const sheet = await page.locator('[data-colour-me] .sheet').boundingBox();
  await page.mouse.click(sheet.x + (sheet.width * 560) / 1166, sheet.y + (sheet.height * 850) / 1200);
  const after = await coloured();
  check(after > before + 5000, `tapping the fox's shorts colours them (${after - before} px)`);
  await page.screenshot({ path: join(out, 'site-home-coloured.png') });
  await Promise.all([page.waitForURL(/\/color\/#wildwood-29$/), page.locator('[data-studio]').click()]);
  await page.waitForSelector('body[data-ready="wildwood-29"]', { timeout: 15000 });
  const inStudio = await inked(page);
  check(Math.abs(inStudio - after) < after * 0.02, `the Studio opens the fox as it was left (${inStudio} px)`);
  await context.close();
}

// Website: every page in the sitemap loads cleanly, every internal link, image and download works,
// and each page describes itself for search engines.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.includes('/no-such-page/')) errors.push(`${m.text()} (${m.location().url})`);
  });
  const xml = await (await page.request.get(`${base}/sitemap-0.xml`)).text();
  const pages = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, base));
  check(pages.length >= 9, `sitemap lists ${pages.length} pages`);
  const refs = new Set();
  const problems = [];
  for (const url of [...pages, `${base}/contact/`]) {
    const res = await page.goto(url);
    const name = url.slice(base.length) || '/';
    if (!res.ok()) problems.push(`${name} returned ${res.status()}`);
    const info = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content ?? '',
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? '',
      h1: document.querySelectorAll('h1').length,
      noindex: Boolean(document.querySelector('meta[name="robots"][content*="noindex"]')),
      schema: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)['@type']),
      refs: [
        ...[...document.querySelectorAll('a[href], link[href]')].map((a) => a.href),
        ...[...document.querySelectorAll('img[src], script[src]')].map((e) => e.src),
        ...[...document.querySelectorAll('img[srcset], source[srcset]')].flatMap((e) =>
          e.srcset.split(',').map((part) => new URL(part.trim().split(/\s+/)[0], location.href).href)),
      ],
    }));
    if (info.h1 !== 1) problems.push(`${name} has ${info.h1} h1 headings`);
    if (info.title.length < 15 || info.title.length > 75) problems.push(`${name} title is ${info.title.length} characters`);
    if (info.description.length < 70 || info.description.length > 170) problems.push(`${name} description is ${info.description.length} characters`);
    if (!info.canonical.startsWith('https://mjartel.fyi/')) problems.push(`${name} canonical is ${info.canonical}`);
    if (/coloring-book\/$/.test(name) && !info.schema.includes('Book')) problems.push(`${name} has no Book data`);
    if (name.includes('/blog/') && name !== '/blog/' && !info.schema.includes('Article')) problems.push(`${name} has no Article data`);
    for (const r of info.refs) {
      const u = new URL(r);
      u.hash = '';
      if (u.href.startsWith(`${base}/`) || u.href === `${base}/`) refs.add(u.href);
    }
  }
  check(problems.length === 0, `pages are well formed${problems.length ? `: ${problems.join('; ')}` : ''}`);
  const broken = [];
  for (const r of refs) {
    const res = await page.request.get(r);
    if (!res.ok()) broken.push(`${r.slice(base.length)} (${res.status()})`);
  }
  check(broken.length === 0, `${refs.size} internal links, images and files work${broken.length ? `: ${broken.join(', ')}` : ''}`);
  const missing = await page.goto(`${base}/no-such-page/`);
  check(missing.status() === 404 && (await page.locator('h1').textContent()).includes('Wildwoods'), 'unknown pages get the friendly 404');

  for (const [name, path] of [['home', '/'], ['book', '/wildwood-games-coloring-book/'], ['free', '/free-coloring-pages/'], ['article', '/blog/field-day-activities-for-kids/']]) {
    await page.goto(`${base}${path}`);
    await fullShot(page, join(out, `site-${name}.png`));
  }
  await context.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  for (const [name, path] of [['home', '/'], ['book', '/robot-coloring-book/']]) {
    await p.goto(`${base}${path}`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no sideways scrolling on the ${name} page on a phone`);
    await fullShot(p, join(out, `site-${name}-phone.png`));
  }
  await phone.close();
}

// Buy buttons follow the visitor's Amazon.
for (const [locale, host] of [['en-US', 'www.amazon.com'], ['en-CA', 'www.amazon.ca'], ['en-GB', 'www.amazon.co.uk']]) {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/`);
  const wildwood = await page.locator('.buy[data-buy="wildwood"] .btn-buy').first().getAttribute('href');
  await page.goto(`${base}/robot-coloring-book/`);
  const robot = await page.locator('.buy[data-buy="robot"] .btn-buy').first().getAttribute('href');
  const also = await page.locator('.buy[data-buy="robot"] .buy-stores').first().textContent();
  check(new URL(wildwood).host === host, `${locale}: Wildwood goes to ${new URL(wildwood).host}`);
  check(new URL(robot).host === host, `${locale}: Robot book goes to ${new URL(robot).host}`);
  check(!also.includes(host.replace('www.a', 'A')), `${locale}: "Also on" lists the other stores (${also.trim()})`);
  await context.close();
}

await browser.close();
if (server.listening) server.close();
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
console.log(failures.length ? `\n${failures.length} failed` : '\nall good');
process.exit(failures.length ? 1 : 0);
