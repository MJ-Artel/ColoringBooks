// The paint layer and everything that changes it: strokes, fills, undo.
// Plain JavaScript over typed arrays (no DOM), so it behaves the same in the browser and in Node tests.
//
// A stroke works like this: stamps of the brush tip raise a per-pixel coverage map (`cov`, max, never
// summed, so a stroke crossing itself stays even). Each frame, the changed area is re-rendered from the
// snapshot taken when the stroke began (`before`) plus the coverage, through the tool's deposit model and
// blend mode. Nothing is drawn twice, so the preview is exactly what gets committed.

import { TEX_MASK, TEX_SHIFT } from './textures.js';
import { regionAt, regionMask } from './regions.js';

const UNDO_BYTES = 96 * 1024 * 1024;
const UNDO_STEPS = 60;
const MASK_BYTES = 24 * 1024 * 1024;
const FILL_RADIUS = 24; // stands in for brush size when a fill dries

const union = (r, x0, y0, x1, y1) =>
  r ? [Math.min(r[0], x0), Math.min(r[1], y0), Math.max(r[2], x1), Math.max(r[3], y1)] : [x0, y0, x1, y1];

// Two-pass box blur, zero outside the box.
function blur(src, w, h, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length), span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x < Math.min(r, w); x++) sum += src[row + x];
    for (let x = 0; x < w; x++) {
      if (x + r < w) sum += src[row + x + r];
      if (x - r - 1 >= 0) sum -= src[row + x - r - 1];
      tmp[row + x] = sum / span;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < Math.min(r, h); y++) sum += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + r < h) sum += tmp[(y + r) * w + x];
      if (y - r - 1 >= 0) sum -= tmp[(y - r - 1) * w + x];
      out[y * w + x] = sum / span;
    }
  }
  return out;
}

export class Engine {
  constructor(w, h, textures, regions, random = Math.random) {
    this.w = w;
    this.h = h;
    this.tex = textures;
    this.regions = regions;
    this.random = random;
    this.paint = new Uint8ClampedArray(w * h * 4); // straight (not premultiplied) RGBA, like ImageData
    this.before = new Uint8ClampedArray(w * h * 4); // paint as it was when the current stroke began
    this.cov = new Uint8Array(w * h); // how firmly the current stroke has touched each pixel
    this.clip = new Uint8Array(w * h); // region mask while staying inside the lines
    this.clipBox = null;
    this.useClip = false;
    this.masks = new Map();
    this.maskBytes = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.undoBytes = 0;
    this.op = null; // the stroke in progress
    this.pending = null; // area whose coverage changed and needs rendering
    this.dirty = null; // area of `paint` the display hasn't copied yet
    this.version = 0; // bumps on every committed change (autosave watches it)
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get drawing() { return this.op !== null; }

  // --- strokes -------------------------------------------------------------------------------------

  // tool: from brushes.js; rgb: [r, g, b]; radius in page pixels; pressure 0..1;
  // clip: keep the stroke inside the region it starts in.
  begin(tool, { x, y, pressure = 1, rgb = [0, 0, 0], radius, clip = false }) {
    if (this.op) this.end();
    this.before.set(this.paint);
    const tip = tool.chisel ? radius * tool.chisel.aspect : radius;
    this.op = {
      tool,
      rgb: tool.fixedColour || rgb,
      radius,
      spacing: Math.max(0.5, tip * (tool.spacing || 0.15)),
      carry: 0,
      box: null,
      ox: (this.random() * 4096) | 0, // pigment and glitter shift per stroke; the paper's tooth doesn't
      oy: (this.random() * 4096) | 0,
      load: this._load(tool, pressure),
      last: { x, y, p: pressure },
      mid: { x, y, p: pressure },
    };
    this.useClip = clip && this._clipTo(regionAt(this.regions, x, y));
    this._stamp(x, y, pressure);
  }

  move(x, y, pressure = 1) {
    const op = this.op;
    if (!op || (x === op.last.x && y === op.last.y)) return;
    // Quadratic smoothing: curve from the previous midpoint to the new one, bending through the last point.
    const mid = { x: (op.last.x + x) / 2, y: (op.last.y + y) / 2, p: (op.last.p + pressure) / 2 };
    this._curve(op.mid, op.last, mid);
    op.mid = mid;
    op.last = { x, y, p: pressure };
  }

  end() {
    const op = this.op;
    if (!op) return;
    this._segment(op.mid.x, op.mid.y, op.mid.p, op.last.x, op.last.y, op.last.p);
    this._renderPending();
    if (op.box) this._commit(op.tool.dry ? this._dry(op.box, op.tool.dry, op.radius, true) : op.box);
    this.op = null;
  }

  // Abandon the stroke in progress (a second finger arrived: it was a pinch, not a line).
  cancel() {
    const op = this.op;
    if (!op) return;
    if (op.box) {
      this._paste(this._crop(this.before, op.box), op.box);
      this._clearCoverage(op.box);
    }
    this.pending = null;
    this.op = null;
  }

  // --- paint bucket ---------------------------------------------------------------------------------

  // Fills the shape under (x, y) with a look (a tool, or FLAT). Returns false if there is no shape there.
  fill(x, y, look, { rgb, pressure = 1 }) {
    const id = regionAt(this.regions, x, y, 8);
    if (id < 0) return false;
    const m = this._mask(id);
    const box = [m.x0, m.y0, m.x1, m.y1];
    this.before.set(this.paint);
    this.op = { tool: look, rgb: look.fixedColour || rgb, radius: FILL_RADIUS, ox: (this.random() * 4096) | 0,
      oy: (this.random() * 4096) | 0, load: this._load(look, pressure), box };
    this.useClip = false;
    const v = Math.round(this._pressureFactor(look, pressure) * 255);
    const bw = m.x1 - m.x0;
    for (let y = m.y0; y < m.y1; y++) {
      const row = y * this.w, src = (y - m.y0) * bw;
      for (let x = m.x0; x < m.x1; x++) this.cov[row + x] = m.data[src + x - m.x0] ? v : 0;
    }
    this._render(...box);
    if (look.dry) this._dry(box, look.dry, FILL_RADIUS, false);
    this._markDirty(box);
    this._commit(box);
    this.op = null;
    return true;
  }

  // --- history and whole-page changes --------------------------------------------------------------

  undo() {
    const e = this.undoStack.pop();
    if (!e) return false;
    this._paste(e.before, e.box);
    this.redoStack.push(e);
    this.version++;
    return true;
  }

  redo() {
    const e = this.redoStack.pop();
    if (!e) return false;
    this._paste(e.after, e.box);
    this.undoStack.push(e);
    this.version++;
    return true;
  }

  clear() {
    if (this.isBlank()) return false;
    this.before.set(this.paint);
    this.paint.fill(0);
    const box = [0, 0, this.w, this.h];
    this._pushUndo(box);
    this._markDirty(box);
    this.version++;
    return true;
  }

  // Replace the paint with saved pixels (same size). Starts a fresh history.
  load(rgba) {
    this.paint.set(rgba);
    this.undoStack = [];
    this.redoStack = [];
    this.undoBytes = 0;
    this._markDirty([0, 0, this.w, this.h]);
  }

  isBlank() {
    const p = this.paint;
    for (let j = 3; j < p.length; j += 4) if (p[j]) return false;
    return true;
  }

  // Renders whatever the latest stamps touched; returns the area of `paint` to copy to the screen.
  update() {
    this._renderPending();
    const d = this.dirty;
    this.dirty = null;
    return d;
  }

  // --- internals ------------------------------------------------------------------------------------

  // How hard the tip presses into the paper (coverage). Watercolour coverage is the brush shape only;
  // pressure sets how much pigment the brush carries for the whole stroke instead (`_load`).
  _pressureFactor(tool, p) {
    return tool.pressure && tool.model !== 'wash' ? p : 1;
  }

  _load(tool, p) {
    return tool.model === 'wash' ? 0.55 + 0.6 * p : 1;
  }

  _curve(a, c, b) {
    const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
    const n = Math.max(1, Math.ceil(len / 2));
    let px = a.x, py = a.y, pp = a.p;
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
      const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      const p = a.p + (b.p - a.p) * t;
      this._segment(px, py, pp, x, y, p);
      px = x;
      py = y;
      pp = p;
    }
  }

  // Stamps evenly along a straight piece of the path, carrying leftover distance to the next piece.
  _segment(x0, y0, p0, x1, y1, p1) {
    const op = this.op, d = Math.hypot(x1 - x0, y1 - y0);
    if (d === 0) return;
    let at = op.spacing - op.carry;
    if (at > d) {
      op.carry += d;
      return;
    }
    let last = 0;
    for (; at <= d; at += op.spacing) {
      const f = at / d;
      this._stamp(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, p0 + (p1 - p0) * f);
      last = at;
    }
    op.carry = d - last;
  }

  _stamp(x, y, p) {
    const op = this.op, tool = op.tool, { w, h, cov } = this;
    const pf = this._pressureFactor(tool, p);
    const r = op.radius * (tool.pressure ? 0.75 + 0.25 * p : 1);
    const edge = Math.max(1, r * (1 - (tool.hardness ?? 0.8))); // width of the soft rim
    const reach = r + edge;
    const x0 = Math.max(0, Math.floor(x - reach)), x1 = Math.min(w, Math.ceil(x + reach) + 1);
    const y0 = Math.max(0, Math.floor(y - reach)), y1 = Math.min(h, Math.ceil(y + reach) + 1);
    if (x0 >= x1 || y0 >= y1) return;
    const chisel = tool.chisel;
    let ca = 1, sa = 0, rb = r;
    if (chisel) {
      const ang = (chisel.angle * Math.PI) / 180;
      ca = Math.cos(ang);
      sa = Math.sin(ang);
      rb = Math.max(1, r * chisel.aspect);
    }
    const rim = Math.min(edge, rb);
    for (let py = y0; py < y1; py++) {
      const dy = py + 0.5 - y, row = py * w;
      for (let px = x0; px < x1; px++) {
        const dx = px + 0.5 - x;
        let outside; // signed distance past the tip's outline, in pixels
        if (chisel) {
          // Measured along the ray from the centre, so the nib's long ends stay as crisp as its sides.
          const u = dx * ca + dy * sa, v = dy * ca - dx * sa;
          const d = Math.sqrt((u / r) * (u / r) + (v / rb) * (v / rb));
          outside = d > 0 ? Math.sqrt(dx * dx + dy * dy) * (1 - 1 / d) : -rb;
        } else {
          outside = Math.sqrt(dx * dx + dy * dy) - r;
        }
        let a = 0.5 - outside / (chisel ? rim : edge);
        if (a <= 0) continue;
        if (a > 1) a = 1;
        const v = a * a * (3 - 2 * a) * pf * 255;
        if (v > cov[row + px]) cov[row + px] = v;
      }
    }
    op.box = union(op.box, x0, y0, x1, y1);
    this.pending = union(this.pending, x0, y0, x1, y1);
  }

  _renderPending() {
    const p = this.pending;
    if (!p || !this.op) return;
    this.pending = null;
    this._render(p[0], p[1], p[2], p[3]);
    this._markDirty(p);
  }

  _render(x0, y0, x1, y1, edge = null, edgeGain = 0) {
    const { w, paint, before, cov, clip, useClip, tex } = this;
    const op = this.op, tool = op.tool, model = tool.model;
    const [cr, cg, cb] = op.rgb;
    const multiply = tool.blend === 'multiply';
    const grain = tool.tex === 'crayon' ? tex.crayon : tex.paper;
    const { paper, wash, sparkle } = tex;
    const opacity = tool.opacity ?? 1, soft = tool.soft ?? 0.1, bite = tool.bite ?? 1;
    const jitter = tool.jitter || 0, streak = tool.streak || 0;
    const ox = op.ox, oy = op.oy, ew = x1 - x0;
    for (let y = y0; y < y1; y++) {
      const row = (y & TEX_MASK) << TEX_SHIFT; // fixed to the paper
      const rowo = ((y + oy) & TEX_MASK) << TEX_SHIFT; // moves with each stroke
      for (let x = x0; x < x1; x++) {
        const i = y * w + x, j = i << 2;
        let c = cov[i];
        if (useClip && clip[i] === 0) c = 0;
        if (c === 0) {
          paint[j] = before[j];
          paint[j + 1] = before[j + 1];
          paint[j + 2] = before[j + 2];
          paint[j + 3] = before[j + 3];
          continue;
        }
        const f = c / 255;
        let a, r = cr, g = cg, b = cb;
        if (model === 'grain') {
          // Pigment reaches every bump of the paper higher than the threshold; pressing harder lowers it.
          const lo = 1 - f * bite - soft;
          let u = (grain[row | (x & TEX_MASK)] / 255 - lo) / (2 * soft);
          u = u < 0 ? 0 : u > 1 ? 1 : u;
          a = u * u * (3 - 2 * u) * opacity * (f < 0.25 ? f * 4 : 1);
          if (jitter) {
            const k = 1 + (paper[rowo | ((x + ox) & TEX_MASK)] / 255 - 0.5) * jitter;
            r *= k;
            g *= k;
            b *= k;
          }
        } else if (model === 'wash') {
          a = f * tool.load * op.load
            * (1 + tool.blotch * (wash[rowo | ((x + ox) & TEX_MASK)] / 255 - 0.5))
            * (1 + tool.granulation * (0.5 - paper[row | (x & TEX_MASK)] / 255));
        } else if (model === 'glitter') {
          a = f * opacity;
          const s = sparkle[rowo | ((x + ox) & TEX_MASK)] / 255;
          if (s) {
            r += (255 - r) * s * 0.9;
            g += (255 - g) * s * 0.9;
            b += (255 - b) * s * 0.9;
          } else if (paper[rowo | ((x + ox + 97) & TEX_MASK)] < 8) {
            r *= 0.75;
            g *= 0.75;
            b *= 0.75;
          }
        } else if (model === 'flat') {
          a = 1;
        } else if (model === 'ink') {
          a = f * opacity;
          if (streak) a *= 1 + streak * (paper[row | (x & TEX_MASK)] / 255 - 0.5); // ink soaks in unevenly
        } else {
          a = f * opacity; // erase
        }
        if (edge) a *= 1 + edge[(y - y0) * ew + (x - x0)] * edgeGain;
        if (a > 1) a = 1;
        if (model === 'erase') {
          paint[j] = before[j];
          paint[j + 1] = before[j + 1];
          paint[j + 2] = before[j + 2];
          paint[j + 3] = before[j + 3] * (1 - a);
          continue;
        }
        const ba = before[j + 3] / 255;
        if (multiply && ba > 0) {
          // W3C multiply: blend with the colour underneath in proportion to how much colour is there.
          r = r * (1 - ba) + ((r * before[j]) / 255) * ba;
          g = g * (1 - ba) + ((g * before[j + 1]) / 255) * ba;
          b = b * (1 - ba) + ((b * before[j + 2]) / 255) * ba;
        }
        const keep = ba * (1 - a), ao = a + keep;
        if (ao <= 0) {
          paint[j] = paint[j + 1] = paint[j + 2] = paint[j + 3] = 0;
          continue;
        }
        paint[j] = (r * a + before[j] * keep) / ao;
        paint[j + 1] = (g * a + before[j + 1] * keep) / ao;
        paint[j + 2] = (b * a + before[j + 2] * keep) / ao;
        paint[j + 3] = ao * 255;
      }
    }
  }

  // Drying. A wet stroke's soft edge settles into an uneven line (bleed), and pigment gathers at the rim:
  // the rim is wherever coverage beats its own blur. Returns the area changed, which bleed can widen.
  _dry(box, { blur: spread, edge: gain, bleed = 0 }, radius, isStroke) {
    const { w, h, cov, clip, useClip } = this;
    const r = Math.max(1, Math.round(radius * spread));
    const spreads = bleed > 0 && isStroke;
    if (spreads) box = [Math.max(0, box[0] - r), Math.max(0, box[1] - r), Math.min(w, box[2] + r), Math.min(h, box[3] + r)];
    const [x0, y0, x1, y1] = box, bw = x1 - x0, bh = y1 - y0;
    const c = new Float32Array(bw * bh);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        c[(y - y0) * bw + x - x0] = useClip && clip[i] === 0 ? 0 : cov[i] / 255;
      }
    }
    if (spreads) {
      const { wash, paper } = this.tex, { ox, oy } = this.op, wet = blur(c, bw, bh, r);
      for (let y = y0; y < y1; y++) {
        const row = (y & TEX_MASK) << TEX_SHIFT, rowo = ((y + oy) & TEX_MASK) << TEX_SHIFT;
        for (let x = x0; x < x1; x++) {
          const k = (y - y0) * bw + x - x0;
          const n = (0.6 * wash[rowo | ((x + ox) & TEX_MASK)] + 0.4 * paper[row | (x & TEX_MASK)]) / 255;
          let u = (wet[k] + (n - 0.5) * bleed - 0.3) / 0.3;
          u = u < 0 ? 0 : u > 1 ? 1 : u;
          c[k] = u * u * (3 - 2 * u);
          cov[y * w + x] = c[k] * 255;
        }
      }
    }
    const soft = blur(blur(c, bw, bh, r), bw, bh, r);
    const rim = new Float32Array(bw * bh);
    for (let k = 0; k < rim.length; k++) {
      if (c[k] > 0) rim[k] = Math.min(1, Math.max(0, (c[k] - soft[k]) * 2.5));
    }
    this._render(x0, y0, x1, y1, rim, gain);
    this._markDirty(box);
    return box;
  }

  _commit(box) {
    this._pushUndo(box);
    this._clearCoverage(box);
    this.version++;
  }

  _clearCoverage([x0, y0, x1, y1]) {
    for (let y = y0; y < y1; y++) this.cov.fill(0, y * this.w + x0, y * this.w + x1);
  }

  _clipTo(id) {
    if (id < 0) return false;
    const m = this._mask(id);
    if (this.clipBox) {
      const [x0, y0, x1, y1] = this.clipBox;
      for (let y = y0; y < y1; y++) this.clip.fill(0, y * this.w + x0, y * this.w + x1);
    }
    const bw = m.x1 - m.x0;
    for (let y = m.y0; y < m.y1; y++) this.clip.set(m.data.subarray((y - m.y0) * bw, (y - m.y0 + 1) * bw), y * this.w + m.x0);
    this.clipBox = [m.x0, m.y0, m.x1, m.y1];
    return true;
  }

  _mask(id) {
    let m = this.masks.get(id);
    if (m) {
      this.masks.delete(id); // most recently used goes last
      this.masks.set(id, m);
      return m;
    }
    m = regionMask(this.regions, id);
    this.masks.set(id, m);
    this.maskBytes += m.data.length;
    for (const [key, old] of this.masks) {
      if (this.maskBytes <= MASK_BYTES || key === id) break;
      this.masks.delete(key);
      this.maskBytes -= old.data.length;
    }
    return m;
  }

  _crop(src, [x0, y0, x1, y1]) {
    const bw = x1 - x0, out = new Uint8ClampedArray(bw * (y1 - y0) * 4);
    for (let y = y0; y < y1; y++) out.set(src.subarray((y * this.w + x0) * 4, (y * this.w + x1) * 4), (y - y0) * bw * 4);
    return out;
  }

  _paste(data, box) {
    const [x0, y0, x1, y1] = box, bw = x1 - x0;
    for (let y = y0; y < y1; y++) this.paint.set(data.subarray((y - y0) * bw * 4, (y - y0 + 1) * bw * 4), (y * this.w + x0) * 4);
    this._markDirty(box);
  }

  _pushUndo(box) {
    const entry = { box, before: this._crop(this.before, box), after: this._crop(this.paint, box) };
    for (const e of this.redoStack) this.undoBytes -= e.before.length + e.after.length;
    this.redoStack = [];
    this.undoStack.push(entry);
    this.undoBytes += entry.before.length + entry.after.length;
    while (this.undoStack.length > UNDO_STEPS || (this.undoBytes > UNDO_BYTES && this.undoStack.length > 1)) {
      const old = this.undoStack.shift();
      this.undoBytes -= old.before.length + old.after.length;
    }
  }

  _markDirty([x0, y0, x1, y1]) {
    this.dirty = union(this.dirty, x0, y0, x1, y1);
  }
}
