import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTextures, TEX } from '../color/js/textures.js';
import { findRegions, regionAt, regionMask } from '../color/js/regions.js';
import { Engine } from '../color/js/engine.js';
import { TOOLS, FLAT, radiusFor, sliderFor } from '../color/js/brushes.js';

const textures = makeTextures();

// 40x40 page: a 2px-thick square outline from (10,10) to (29,29), so an inside and an outside region.
function squarePage() {
  const w = 40, h = 40, lum = new Uint8Array(w * h).fill(255);
  for (let y = 10; y < 30; y++) {
    for (let x = 10; x < 30; x++) {
      const ring = x < 12 || x >= 28 || y < 12 || y >= 28;
      if (ring) lum[y * w + x] = 0;
    }
  }
  return { w, h, lum, regions: findRegions(lum, w, h) };
}

const px = (e, x, y) => Array.from(e.paint.subarray((y * e.w + x) * 4, (y * e.w + x) * 4 + 4));
let seed = 1;
const fixedRandom = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('textures are equalised bytes', () => {
  for (const key of ['paper', 'crayon', 'wash']) {
    const t = textures[key];
    assert.equal(t.length, TEX * TEX);
    let sum = 0, lo = 255, hi = 0;
    for (const v of t) { sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    assert.ok(Math.abs(sum / t.length - 127.5) < 3, `${key} mean ${sum / t.length}`);
    assert.ok(lo < 5 && hi > 250, `${key} spans ${lo}-${hi}`);
  }
});

test('regions: inside and outside of a closed outline are separate', () => {
  const { regions } = squarePage();
  assert.equal(regions.count, 2);
  const outside = regionAt(regions, 2, 2), inside = regionAt(regions, 20, 20);
  assert.notEqual(outside, inside);
  assert.equal(regionAt(regions, 10.5, 20), outside, 'on the line, nearest region wins');
});

test('region mask tucks under the line but never crosses it', () => {
  const { regions } = squarePage();
  const inside = regionAt(regions, 20, 20);
  const m = regionMask(regions, inside, 2);
  const at = (x, y) => (x < m.x0 || y < m.y0 || x >= m.x1 || y >= m.y1 ? 0 : m.data[(y - m.y0) * (m.x1 - m.x0) + x - m.x0]);
  assert.equal(at(20, 20), 255);
  assert.equal(at(11, 20), 255, 'line pixel next to the region is included');
  assert.equal(at(9, 20), 0, 'outside region is not');
});

test('flat fill colours one region, undo and redo restore it exactly', () => {
  const { w, h, regions } = squarePage();
  const e = new Engine(w, h, textures, regions, fixedRandom);
  assert.ok(e.fill(20, 20, FLAT, { rgb: [200, 40, 30] }));
  assert.deepEqual(px(e, 20, 20), [200, 40, 30, 255]);
  assert.deepEqual(px(e, 3, 3), [0, 0, 0, 0]);
  assert.ok(e.undo());
  assert.ok(e.isBlank());
  assert.ok(e.redo());
  assert.deepEqual(px(e, 20, 20), [200, 40, 30, 255]);
  assert.ok(e.cov.every((v) => v === 0), 'coverage is reset after a fill');
});

test('marker multiplies over existing colour', () => {
  const { w, h, regions } = squarePage();
  const e = new Engine(w, h, textures, regions, fixedRandom);
  e.fill(20, 20, FLAT, { rgb: [255, 255, 0] });
  e.begin(TOOLS.marker, { x: 20, y: 20, rgb: [0, 0, 255], radius: 3 });
  e.end();
  const [r, g, b, a] = px(e, 20, 20);
  assert.equal(a, 255);
  assert.ok(r < 60 && g < 60 && b < 10, `yellow under blue ink goes dark: ${[r, g, b]}`);
});

test('staying inside the lines keeps a stroke in its region', () => {
  const { w, h, regions } = squarePage();
  const e = new Engine(w, h, textures, regions, fixedRandom);
  e.begin(TOOLS.marker, { x: 20, y: 20, rgb: [0, 128, 0], radius: 4, clip: true });
  e.move(5, 20);
  e.end();
  assert.ok(px(e, 15, 20)[3] > 0, 'inside is coloured');
  assert.equal(px(e, 5, 20)[3], 0, 'outside stays clean');
});

test('a stroke without clipping crosses the line', () => {
  const { w, h, regions } = squarePage();
  const e = new Engine(w, h, textures, regions, fixedRandom);
  e.begin(TOOLS.marker, { x: 20, y: 20, rgb: [0, 128, 0], radius: 4 });
  e.move(5, 20);
  e.end();
  assert.ok(px(e, 5, 20)[3] > 0);
});

test('eraser removes colour; cancel leaves the page as it was', () => {
  const { w, h, regions } = squarePage();
  const e = new Engine(w, h, textures, regions, fixedRandom);
  e.fill(20, 20, FLAT, { rgb: [10, 20, 30] });
  e.begin(TOOLS.eraser, { x: 20, y: 20, radius: 4 });
  e.end();
  assert.equal(px(e, 20, 20)[3], 0);
  const snapshot = e.paint.slice();
  e.begin(TOOLS.crayon, { x: 16, y: 16, rgb: [255, 0, 0], radius: 6, pressure: 1 });
  e.move(24, 24, 1);
  e.update();
  e.cancel();
  assert.deepEqual(e.paint, snapshot);
  assert.equal(e.undoStack.length, 2, 'cancelled stroke adds no history');
});

test('pencil pressure decides how much of the paper tooth is covered', () => {
  const coverage = (pressure) => {
    const w = 120, h = 120, lum = new Uint8Array(w * h).fill(255);
    const e = new Engine(w, h, textures, findRegions(lum, w, h), fixedRandom);
    for (let y = 10; y < 110; y += 4) {
      e.begin(TOOLS.pencil, { x: 10, y, rgb: [0, 0, 0], radius: 4, pressure });
      e.move(110, y, pressure);
      e.end();
    }
    let sum = 0;
    for (let y = 20; y < 100; y++) for (let x = 20; x < 100; x++) sum += px(e, x, y)[3];
    return sum / (80 * 80 * 255);
  };
  const light = coverage(0.25), firm = coverage(0.9);
  assert.ok(light < 0.45, `light pressure leaves paper showing (${light.toFixed(2)})`);
  assert.ok(firm > 0.8, `firm pressure covers (${firm.toFixed(2)})`);
});

test('watercolour dries with a darker rim than its middle', () => {
  const w = 160, h = 80, lum = new Uint8Array(w * h).fill(255);
  const e = new Engine(w, h, textures, findRegions(lum, w, h), fixedRandom);
  e.begin(TOOLS.watercolour, { x: 30, y: 40, rgb: [40, 90, 200], radius: 24, pressure: 1 });
  e.move(130, 40, 1);
  e.end();
  const alphaAt = (y) => {
    let s = 0;
    for (let x = 60; x < 100; x++) s += px(e, x, y)[3];
    return s / 40;
  };
  const middle = alphaAt(40), rim = Math.max(...[20, 21, 22, 23, 24, 25, 26, 27, 28].map(alphaAt));
  assert.ok(rim > middle * 1.15, `rim ${rim.toFixed(0)} vs middle ${middle.toFixed(0)}`);
});

test('size slider and radius round-trip', () => {
  for (const tool of Object.values(TOOLS)) {
    if (!tool.size) continue;
    assert.equal(sliderFor(tool, radiusFor(tool, 37)), 37);
  }
});
