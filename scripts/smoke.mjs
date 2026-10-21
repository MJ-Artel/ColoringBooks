// Browser smoke test for the colouring studio: serves the site, colours a page with every tool on a desktop
// and a phone viewport, checks autosave and the picture download, and writes screenshots.
//   npm run smoke [-- --out <dir>] [-- --base https://mj-artel.github.io/ColoringBooks]
// --base tests a deployed copy instead of serving this folder.
// Needs Playwright with Chromium (`npm i -D playwright`), or PLAYWRIGHT_MODULE pointing at an install.

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? process.argv[outArg + 1] : join(root, 'test-output');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf', '.svg': 'image/svg+xml',
};
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
const baseArg = process.argv.indexOf('--base');
let base = baseArg > 0 ? process.argv[baseArg + 1].replace(/\/$/, '') : '';
if (!base) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const failures = [];
const check = (ok, what) => (ok ? console.log(`ok   ${what}`) : (failures.push(what), console.log(`FAIL ${what}`)));

async function open(options, hash) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(`${m.text()} ${m.location().url}`)) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // Google Fonts may be unreachable from a sandbox; the studio must work without them.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
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

// Landing page: buy buttons follow the visitor's Amazon; studio and free pack are linked.
for (const [locale, host] of [['en-US', 'www.amazon.com'], ['en-CA', 'www.amazon.ca'], ['en-GB', 'www.amazon.co.uk']]) {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`${base}/`);
  await page.waitForFunction(() => document.querySelector('[data-buy="robot"]').textContent !== 'Buy on Amazon');
  const robot = await page.locator('[data-buy="robot"]').getAttribute('href');
  const wildwood = await page.locator('[data-buy="wildwood"]').getAttribute('href');
  check(new URL(robot).host === host, `${locale}: Robot book goes to ${new URL(robot).host}`);
  check(['www.amazon.com', 'www.amazon.ca'].includes(new URL(wildwood).host), `${locale}: Wildwood goes to ${new URL(wildwood).host}`);
  if (locale === 'en-US') {
    await page.screenshot({ path: join(out, 'landing-desktop.png'), fullPage: true });
    const pack = await page.request.get(`${base}/assets/mj-artel-free-colouring-pack.pdf`);
    check(pack.ok(), 'free pack downloads');
  }
  await context.close();
}

await browser.close();
if (server.listening) server.close();
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
console.log(failures.length ? `\n${failures.length} failed` : '\nall good');
process.exit(failures.length ? 1 : 0);
