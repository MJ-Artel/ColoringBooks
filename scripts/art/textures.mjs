// The crayon textures the website's CSS uses (assets/ui/), drawn with the studio's own wax crayon:
// paper showing through a crayon fill, and a scribble that sits behind highlighted words.
//   node scripts/art/textures.mjs [outDir]
import sharp from 'sharp';

const { makeTextures } = await import('../../color/js/textures.js');
const { findRegions } = await import('../../color/js/regions.js');
const { Engine } = await import('../../color/js/engine.js');
const { TOOLS, lookTool } = await import('../../color/js/brushes.js');
const OUT = process.argv[2] || new URL('../../assets/ui/', import.meta.url).pathname;
const textures = makeTextures();
let seed = 3;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function blank(w, h) {
  const lum = new Uint8Array(w * h).fill(255);
  return new Engine(w, h, textures, findRegions(lum, w, h), random);
}

// 1. Paper showing through a crayon fill: white specks, tileable (the fill's texture wraps at 512).
{
  const W = 512, e = blank(W, W);
  e.fill(10, 10, lookTool("crayon"), { rgb: [0, 0, 0], pressure: 0.6 });
  e.update();
  const out = Buffer.alloc(W * W * 4);
  for (let i = 0; i < W * W; i++) {
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 255;
    out[i * 4 + 3] = 255 - e.paint[i * 4 + 3];
  }
  await sharp(out, { raw: { width: W, height: W, channels: 4 } }).png({ compressionLevel: 9, palette: false }).toFile(OUT + 'crayon-specks.png');
}

// 2. A crayon scribble to sit behind words: back-and-forth strokes across a wide band.
async function scribble(name, W, H, { slant = 0.35, passes = 1, gap = 22 } = {}) {
  const e = blank(W, H), tool = TOOLS.crayon;
  for (let p = 0; p < passes; p++) {
    const pad = 26, y0 = pad + p * 8, y1 = H - pad - p * 6;
    e.begin(tool, { x: pad, y: y1, pressure: 0.85, rgb: [0, 0, 0], radius: 15 });
    let x = pad;
    let up = true;
    while (x < W - pad) {
      const nx = Math.min(W - pad, x + gap * (0.8 + random() * 0.4));
      const tx = nx + (up ? slant : -slant) * (y1 - y0) * 0.3;
      const ty = up ? y0 + random() * 10 : y1 - random() * 10;
      const steps = 14;
      const [sx, sy] = [x, up ? y1 : y0];
      for (let k = 1; k <= steps; k++) e.move(sx + ((tx - sx) * k) / steps, sy + ((ty - sy) * k) / steps, 0.75 + random() * 0.25);
      x = nx;
      up = !up;
    }
    e.end();
  }
  e.update();
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 0; out[i * 4 + 3] = e.paint[i * 4 + 3]; }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(OUT + name);
}
await scribble('scribble.png', 900, 150, { passes: 1, gap: 20 });
console.log('ok');
