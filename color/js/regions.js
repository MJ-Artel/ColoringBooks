// Splits a line-art page into colourable regions: connected areas of paper between the lines.
// Used by the paint bucket and by "stay inside the lines". Pure data, no DOM.

export const WALL = 150; // pixels darker than this are part of a line

// lum: one byte per pixel (0 = black ink, 255 = paper).
export function findRegions(lum, w, h) {
  const n = w * h;
  const labels = new Int32Array(n);
  for (let i = 0; i < n; i++) labels[i] = lum[i] < WALL ? -1 : -2; // -1 line, -2 not yet visited
  const stack = new Int32Array(n);
  const boxes = [];
  const sizes = [];
  let count = 0;
  for (let seed = 0; seed < n; seed++) {
    if (labels[seed] !== -2) continue;
    const id = count++;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, size = 0, sp = 0;
    labels[seed] = id;
    stack[sp++] = seed;
    while (sp) {
      const i = stack[--sp], x = i % w, y = (i - x) / w;
      size++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      // 4-connected, so colour can't slip through the corner where two lines meet diagonally.
      if (x > 0 && labels[i - 1] === -2) { labels[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && labels[i + 1] === -2) { labels[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && labels[i - w] === -2) { labels[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && labels[i + w] === -2) { labels[i + w] = id; stack[sp++] = i + w; }
    }
    boxes.push(x0, y0, x1 + 1, y1 + 1);
    sizes.push(size);
  }
  return { w, h, labels, count, boxes: Int32Array.from(boxes), sizes: Int32Array.from(sizes) };
}

// The region under (x, y); on a line, the nearest region within `reach` pixels. -1 if none.
export function regionAt(regions, x, y, reach = 6) {
  const { w, h, labels } = regions;
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let r = 0; r <= reach; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const id = labels[py * w + px];
        if (id >= 0) return id;
      }
    }
  }
  return -1;
}

// Mask (0 or 255) for one region, grown `grow` pixels into the surrounding lines but never into a
// neighbouring region, so colour tucks under the ink instead of leaving a pale halo.
export function regionMask(regions, id, grow = 2) {
  const { w, h, labels, boxes } = regions;
  const x0 = Math.max(0, boxes[id * 4] - grow), y0 = Math.max(0, boxes[id * 4 + 1] - grow);
  const x1 = Math.min(w, boxes[id * 4 + 2] + grow), y1 = Math.min(h, boxes[id * 4 + 3] + grow);
  const bw = x1 - x0, bh = y1 - y0;
  const inside = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const src = (y0 + y) * w + x0, dst = y * bw;
    for (let x = 0; x < bw; x++) inside[dst + x] = labels[src + x] === id ? 1 : 0;
  }
  // Square dilation as two running-count passes.
  const across = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const row = y * bw;
    let count = 0;
    for (let x = 0; x < Math.min(grow, bw); x++) count += inside[row + x];
    for (let x = 0; x < bw; x++) {
      if (x + grow < bw) count += inside[row + x + grow];
      if (x - grow - 1 >= 0) count -= inside[row + x - grow - 1];
      across[row + x] = count > 0 ? 1 : 0;
    }
  }
  const data = new Uint8Array(bw * bh);
  for (let x = 0; x < bw; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(grow, bh); y++) count += across[y * bw + x];
    for (let y = 0; y < bh; y++) {
      if (y + grow < bh) count += across[(y + grow) * bw + x];
      if (y - grow - 1 >= 0) count -= across[(y - grow - 1) * bw + x];
      const k = y * bw + x;
      if (inside[k] || (count > 0 && labels[(y0 + y) * w + x0 + x] === -1)) data[k] = 255;
    }
  }
  return { x0, y0, x1, y1, data };
}
