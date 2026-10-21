// Lists the colourable shapes on a studio page, each with a point well inside it, for writing recipes.
//   node scripts/art/regions.mjs wildwood-73


import sharp from 'sharp';
const { findRegions } = await import('../../color/js/regions.js');
const [id] = process.argv.slice(2);
const { data: lum, info } = await sharp(new URL(`../../color/pages/${id}.png`, import.meta.url).pathname).flatten({ background: '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const r = findRegions(new Uint8Array(lum), W, H);
// distance to the nearest non-region pixel (cheap two-pass chamfer)
const d = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) d[i] = r.labels[i] >= 0 ? 1e9 : 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue; let m = d[i]; if (x) m = Math.min(m, d[i - 1] + 1); if (y) m = Math.min(m, d[i - W] + 1); if (x && y) m = Math.min(m, d[i - W - 1] + 1.4); if (x < W - 1 && y) m = Math.min(m, d[i - W + 1] + 1.4); d[i] = m; }
for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue; let m = d[i]; if (x < W - 1) m = Math.min(m, d[i + 1] + 1); if (y < H - 1) m = Math.min(m, d[i + W] + 1); if (x < W - 1 && y < H - 1) m = Math.min(m, d[i + W + 1] + 1.4); if (x && y < H - 1) m = Math.min(m, d[i + W - 1] + 1.4); d[i] = m; }
const best = new Map();
for (let i = 0; i < W * H; i++) { const l = r.labels[i]; if (l < 0) continue; const b = best.get(l); if (!b || d[i] > b[0]) best.set(l, [d[i], i % W, (i / W) | 0]); }
const rows = [];
for (let l = 0; l < r.count; l++) { const b = best.get(l); if (!b || r.sizes[l] < 150) continue; rows.push({ id: l, size: r.sizes[l], x: b[1], y: b[2], box: Array.from(r.boxes.slice(l * 4, l * 4 + 4)) }); }
rows.sort((a, b) => a.y - b.y || a.x - b.x);
for (const q of rows) console.log(`${q.id}\t${q.size}\t(${q.x},${q.y})\tbox ${q.box.join(',')}`);
