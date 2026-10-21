// Colours a line-art page headlessly with the Colouring Studio's own engine, from a recipe, so pictures on
// the website and in emails look exactly like what visitors make in the studio.
//   node scripts/art/colour.mjs scripts/art/recipes/wildwood-29-start.json <outPrefix> [--marks]
// Writes <outPrefix>.png (paper, colour and lines) and <outPrefix>-paint.png (the colour layer only).
// Recipe: { page, seed, ops: [...] } where each op is one of
//   { fill: [x, y], look: "crayon", hex: "#f18f0c", pressure }        paint bucket, in page pixels
//   { scribble: [x0, y0, x1, y1], at: [x, y], tool, hex, angle, gap, radius, pressure, part, clip }
//                                                                     back-and-forth strokes across a box
//   { stroke: [[x, y], ...], tool, hex, radius, pressure, clip }      one stroke
// --marks draws the op points, to check they land in the right shapes (scripts/art/regions.mjs lists them).
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { makeTextures } from '../../color/js/textures.js';
import { findRegions } from '../../color/js/regions.js';
import { Engine } from '../../color/js/engine.js';
import { TOOLS, lookTool } from '../../color/js/brushes.js';

const [recipePath, outPrefix, ...flags] = process.argv.slice(2);
const recipe = JSON.parse(readFileSync(recipePath, 'utf8'));
const src = new URL(`../../color/pages/${recipe.page}.png`, import.meta.url);
const { data: lum, info } = await sharp(src.pathname).flatten({ background: '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
let seed = recipe.seed || 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const e = new Engine(W, H, makeTextures(), findRegions(new Uint8Array(lum), W, H), random);
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const marks = [];

for (const op of recipe.ops) {
  if (op.fill) {
    if (!e.fill(op.fill[0], op.fill[1], lookTool(op.look || 'crayon'), { rgb: hex(op.hex), pressure: op.pressure ?? 0.9 })) {
      console.warn('no shape at', op.fill);
    }
    marks.push(op.fill);
  } else if (op.scribble) {
    const [x0, y0, x1, y1] = op.scribble;
    const ang = ((op.angle ?? -30) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.hypot(x1 - x0, y1 - y0) / 2;
    const gap = op.gap || 14, pressure = op.pressure ?? 0.8;
    const offsets = [];
    for (let d = -half; d <= half; d += gap) offsets.push(d);
    const at = op.at || [cx, cy];
    e.begin(TOOLS[op.tool || 'crayon'], { x: at[0], y: at[1], pressure, rgb: hex(op.hex), radius: op.radius || 10, clip: op.clip ?? true });
    let dir = 1;
    for (const d of offsets.slice(0, Math.ceil(offsets.length * (op.part ?? 1)))) {
      const px = cx - sa * d, py = cy + ca * d;
      const pts = [];
      for (let s = -half; s <= half; s += 6) {
        const x = px + ca * s * dir, y = py + sa * s * dir;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) pts.push([x + (random() - 0.5) * 2, y + (random() - 0.5) * 2]);
      }
      for (const [x, y] of pts) e.move(x, y, pressure * (0.85 + random() * 0.3));
      dir = -dir;
    }
    e.end();
    marks.push(at);
  } else if (op.stroke) {
    const pts = op.stroke, pressure = op.pressure ?? 0.8;
    e.begin(TOOLS[op.tool || 'crayon'], { x: pts[0][0], y: pts[0][1], pressure, rgb: hex(op.hex), radius: op.radius || 10, clip: op.clip ?? false });
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
      for (let k = 1; k <= n; k++) e.move(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, pressure * (0.9 + random() * 0.2));
    }
    e.end();
  }
}
e.update();

// paper, then the colour, then the lines multiplied on top
const out = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const a = e.paint[i * 4 + 3] / 255, l = lum[i] / 255;
  for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round((e.paint[i * 4 + c] * a + 255 * (1 - a)) * l);
}
let img = sharp(out, { raw: { width: W, height: H, channels: 3 } });
if (flags.includes('--marks')) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${marks
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" fill="#f0f"/><text x="${x + 12}" y="${y + 8}" font-size="26" fill="#f0f">${i}</text>`)
    .join('')}</svg>`;
  img = sharp(await img.png().toBuffer()).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]);
}
await img.png().toFile(`${outPrefix}.png`);
await sharp(Buffer.from(e.paint.buffer), { raw: { width: W, height: H, channels: 4 } }).png().toFile(`${outPrefix}-paint.png`);
console.log(`wrote ${outPrefix}.png and ${outPrefix}-paint.png`);
