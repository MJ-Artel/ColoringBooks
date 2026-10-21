// Tileable noise fields that give each medium its texture. Pure data, no DOM.
// Every field is TEX x TEX bytes and is rank-equalised, so a threshold t keeps roughly (1 - t) of the pixels.

export const TEX = 512;
export const TEX_MASK = TEX - 1;
export const TEX_SHIFT = 9;

export function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (t) => t * t * (3 - 2 * t);

// Smooth value noise on a lattice that wraps, so the field tiles. `cell` must divide TEX.
function addValueNoise(field, rand, cell, weight) {
  const n = TEX / cell;
  const lattice = new Float32Array(n * n);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  for (let y = 0; y < TEX; y++) {
    const gy = y / cell, iy = Math.floor(gy), fy = ease(gy - iy);
    const r0 = (iy % n) * n, r1 = ((iy + 1) % n) * n;
    for (let x = 0; x < TEX; x++) {
      const gx = x / cell, ix = Math.floor(gx), fx = ease(gx - ix);
      const c0 = ix % n, c1 = (ix + 1) % n;
      const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * fx;
      const bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * fx;
      field[y * TEX + x] += (top + (bottom - top) * fy) * weight;
    }
  }
}

function addWhiteNoise(field, rand, weight) {
  for (let i = 0; i < field.length; i++) field[i] += rand() * weight;
}

// 3x3 box blur with wrap-around, softening single-pixel speckle into paper tooth.
function soften(field) {
  const tmp = new Float32Array(field.length);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const row = y * TEX;
      tmp[row + x] = (field[row + ((x - 1) & TEX_MASK)] + field[row + x] + field[row + ((x + 1) & TEX_MASK)]) / 3;
    }
  }
  for (let y = 0; y < TEX; y++) {
    const up = ((y - 1) & TEX_MASK) * TEX, row = y * TEX, down = ((y + 1) & TEX_MASK) * TEX;
    for (let x = 0; x < TEX; x++) field[row + x] = (tmp[up + x] + tmp[row + x] + tmp[down + x]) / 3;
  }
}

function equalise(field) {
  let lo = Infinity, hi = -Infinity;
  for (const v of field) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const BINS = 4096, hist = new Uint32Array(BINS), scale = (BINS - 1) / (hi - lo || 1);
  for (const v of field) hist[((v - lo) * scale) | 0]++;
  const map = new Uint8Array(BINS);
  let run = 0;
  for (let b = 0; b < BINS; b++) {
    map[b] = Math.round(((run + hist[b] / 2) / field.length) * 255);
    run += hist[b];
  }
  const out = new Uint8Array(field.length);
  for (let i = 0; i < field.length; i++) out[i] = map[((field[i] - lo) * scale) | 0];
  return out;
}

// Tiny four-point stars for the glitter pen.
function sparkles(rand) {
  const out = new Uint8Array(TEX * TEX);
  const put = (x, y, v) => {
    const i = ((y & TEX_MASK) << TEX_SHIFT) | (x & TEX_MASK);
    if (v > out[i]) out[i] = v;
  };
  const count = (TEX * TEX) / 90;
  for (let k = 0; k < count; k++) {
    const x = (rand() * TEX) | 0, y = (rand() * TEX) | 0, big = rand() < 0.3;
    put(x, y, 255);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      put(x + dx, y + dy, big ? 210 : 130);
      if (big) put(x + 2 * dx, y + 2 * dy, 90);
    }
  }
  return out;
}

export function makeTextures(seed = 20251021) {
  const rand = mulberry32(seed);
  const N = TEX * TEX;

  // Paper tooth: soft speckle over a faint weave. Pencils and crayons skip the low spots.
  const paper = new Float32Array(N);
  addWhiteNoise(paper, rand, 1);
  soften(paper);
  addValueNoise(paper, rand, 4, 0.22);
  addValueNoise(paper, rand, 16, 0.12);

  // Wax crayon: the same paper with a slightly coarser bite.
  const crayon = new Float32Array(N);
  for (let i = 0; i < N; i++) crayon[i] = paper[i];
  addValueNoise(crayon, rand, 4, 0.16);
  addValueNoise(crayon, rand, 8, 0.08);

  // Watercolour: slow blotches where pigment settles thicker or thinner.
  const wash = new Float32Array(N);
  addValueNoise(wash, rand, 128, 0.6);
  addValueNoise(wash, rand, 32, 0.3);
  addValueNoise(wash, rand, 8, 0.1);

  return { paper: equalise(paper), crayon: equalise(crayon), wash: equalise(wash), sparkle: sparkles(rand) };
}
