// Colouring Studio: connects the paint engine to the page, the pointer, the controls and the browser.

import { makeTextures, TEX } from './textures.js';
import { findRegions } from './regions.js';
import { Engine } from './engine.js';
import { TOOLS, TOOL_ORDER, FILL_LOOKS, lookTool, radiusFor, sliderFor, hexToRgb } from './brushes.js';
import { PALETTES } from './palettes.js';
import { BOOKS, PAGES, storeLink } from './pages.js';
import * as storage from './storage.js';
import { TOOL_ICONS, UI_ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const stage = $('stage');
const sheet = $('sheet');
const canvas = $('paint');
const lines = $('lines');
const cursorEl = $('cursor');
const picker = $('picker');
let ctx = canvas.getContext('2d');

// ---- preferences (remembered per browser) ----------------------------------------------------------

const PREFS_KEY = 'mjartel-studio';
const prefs = {
  tool: 'pencil', colour: '#e8772e', palette: 'wildwood', sizes: {}, pressure: 0.6, clip: true, look: 'flat',
  recent: [], page: PAGES[0].id, welcomed: false,
  ...readPrefs(),
};
if (!TOOLS[prefs.tool]) prefs.tool = 'pencil';
if (!/^#[0-9a-f]{6}$/i.test(prefs.colour)) prefs.colour = '#e8772e';
let lastColourTool = TOOLS[prefs.tool].fixedColour || prefs.tool === 'eraser' ? 'pencil' : prefs.tool;

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

function writePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // private browsing: preferences just aren't remembered
  }
}

// ---- state -----------------------------------------------------------------------------------------

let textures = null;
let tile = null; // paper-tooth tile, also used when exporting
let engine = null;
let page = null;
let imageData = null;
let savedVersion = 0;
let saveTimer = 0;
let loadToken = 0;
const view = { s: 1, tx: 0, ty: 0, fit: 1, zoomed: false };

// ---- building the controls -------------------------------------------------------------------------

function buildIcons() {
  const map = { undo: 'undo', redo: 'redo', zoomIn: 'zoomIn', zoomOut: 'zoomOut', fit: 'fit', closePicker: 'close' };
  for (const el of $$('.icon-btn[data-action]')) el.innerHTML = UI_ICONS[map[el.dataset.action]] || '';
  for (const el of $$('[data-icon]')) el.insertAdjacentHTML('afterbegin', UI_ICONS[el.dataset.icon]);
  $$('.menu summary').forEach((el) => (el.innerHTML = UI_ICONS.more));
}

function buildTools() {
  const box = $('tools');
  TOOL_ORDER.forEach((id, n) => {
    const t = TOOLS[id];
    const label = document.createElement('label');
    label.className = 'tool';
    label.dataset.tool = id;
    label.title = `${t.name} (${n + 1})`;
    label.innerHTML = `<input type="radio" name="tool" value="${id}" aria-label="${t.name}">`
      + `<span class="icon">${TOOL_ICONS[id]}</span><span class="name">${t.short}</span><kbd>${n + 1}</kbd>`;
    box.append(label);
  });
  box.addEventListener('change', (e) => selectTool(e.target.value));
}

function swatch(hex, name, group) {
  const label = document.createElement('label');
  label.className = 'swatch';
  label.title = name;
  label.dataset.hex = hex;
  label.style.setProperty('--c', hex);
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = group;
  input.value = hex;
  input.setAttribute('aria-label', name);
  label.append(input);
  return label;
}

function buildPalettes() {
  const select = $('palette');
  for (const p of PALETTES) select.add(new Option(p.name, p.id));
  if (!PALETTES.some((p) => p.id === prefs.palette)) prefs.palette = PALETTES[0].id;
  select.value = prefs.palette;
  select.addEventListener('change', () => {
    prefs.palette = select.value;
    writePrefs();
    renderSwatches();
  });
  $('swatches').addEventListener('change', (e) => pickColour(e.target.value));
  $('recent').addEventListener('change', (e) => pickColour(e.target.value));
  $('custom').addEventListener('input', (e) => pickColour(e.target.value));
  renderSwatches();
  renderRecent();
}

function renderSwatches() {
  const palette = PALETTES.find((p) => p.id === prefs.palette) || PALETTES[0];
  $('swatches').replaceChildren(...palette.colours.map(([hex, name]) => swatch(hex, name, 'colour')));
  markColour();
}

function renderRecent() {
  $('recent').replaceChildren(...prefs.recent.map((hex) => swatch(hex, `Recent colour ${hex}`, 'recent')));
  $('recentWrap').hidden = prefs.recent.length === 0;
  markColour();
}

function buildSettings() {
  const size = $('size');
  size.addEventListener('input', () => {
    prefs.sizes[prefs.tool] = Number(size.value);
    writePrefs();
    updateSizeDot();
    updateCursorShape();
  });
  const pressure = $('pressure');
  pressure.value = Math.round(prefs.pressure * 100);
  pressure.addEventListener('input', () => {
    prefs.pressure = Number(pressure.value) / 100;
    writePrefs();
    updatePressureHint();
  });
  updatePressureHint();
  const looks = $('looks');
  for (const [id, name] of FILL_LOOKS) {
    const chip = document.createElement('label');
    chip.className = 'chip';
    chip.dataset.look = id;
    chip.innerHTML = `<input type="radio" name="look" value="${id}">${name}`;
    looks.append(chip);
  }
  looks.addEventListener('change', (e) => {
    prefs.look = e.target.value;
    writePrefs();
    markLook();
    selectTool(prefs.tool);
  });
  markLook();
  const clip = $('clip');
  clip.checked = prefs.clip;
  clip.addEventListener('change', () => {
    prefs.clip = clip.checked;
    writePrefs();
  });
}

function markLook() {
  if (!FILL_LOOKS.some(([id]) => id === prefs.look)) prefs.look = 'flat';
  for (const chip of $$('.chip')) {
    const on = chip.dataset.look === prefs.look;
    chip.classList.toggle('is-on', on);
    chip.querySelector('input').checked = on;
  }
}

function updatePressureHint() {
  const p = prefs.pressure;
  $('pressureHint').textContent = p < 0.35 ? 'Light' : p < 0.75 ? 'Medium' : 'Firm';
}

// ---- tools and colours -----------------------------------------------------------------------------

function selectTool(id) {
  if (!TOOLS[id]) return;
  const t = TOOLS[id];
  prefs.tool = id;
  if (!t.fixedColour && id !== 'eraser') lastColourTool = id;
  writePrefs();
  for (const el of $$('.tool')) {
    const on = el.dataset.tool === id;
    el.classList.toggle('is-on', on);
    el.querySelector('input').checked = on;
  }
  $('sizeField').hidden = !t.size;
  if (t.size) $('size').value = prefs.sizes[id] ?? sliderFor(t, t.size[2]);
  $('pressureField').hidden = !(id === 'fill' ? lookTool(prefs.look).pressure : t.pressure);
  $('lookField').hidden = id !== 'fill';
  $('graphiteNote').hidden = id !== 'graphite';
  stage.classList.toggle('is-brush', Boolean(t.size));
  updateSizeDot();
  updateCursorShape();
}

function pickColour(hex) {
  setColour(hex);
  // Picking a colour while holding the pencil or eraser means "I want to colour": go back to the last colour tool.
  const t = TOOLS[prefs.tool];
  if (t.fixedColour || prefs.tool === 'eraser') selectTool(lastColourTool);
}

function setColour(hex) {
  prefs.colour = hex.toLowerCase();
  writePrefs();
  markColour();
  const root = document.documentElement.style;
  root.setProperty('--current', prefs.colour);
  const [r, g, b] = hexToRgb(prefs.colour);
  root.setProperty('--current-ink', 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#2b2620' : '#ffffff');
  $('custom').value = prefs.colour;
}

function markColour() {
  for (const el of $$('.swatch[data-hex]')) {
    const on = el.dataset.hex.toLowerCase() === prefs.colour;
    el.classList.toggle('is-on', on);
    el.querySelector('input').checked = on;
  }
}

function noteRecent(hex) {
  if (prefs.recent[0] === hex) return;
  prefs.recent = [hex, ...prefs.recent.filter((h) => h !== hex)].slice(0, 12);
  writePrefs();
  renderRecent();
}

const currentRadius = () => {
  const t = TOOLS[prefs.tool];
  return t.size ? radiusFor(t, prefs.sizes[prefs.tool] ?? sliderFor(t, t.size[2])) : 0;
};

function updateSizeDot() {
  const d = clamp(2 * currentRadius() * view.s, 3, 40);
  $('sizeDot').style.setProperty('--d', `${d}px`);
}

function nudgeSize(step) {
  const t = TOOLS[prefs.tool];
  if (!t.size) return;
  const size = $('size');
  size.value = clamp(Number(size.value) + step, 0, 100);
  size.dispatchEvent(new Event('input'));
}

// Mouse and stylus pressure. Fingers and mice use the Pressure slider; a stylus scales it.
function pressureOf(ev) {
  if (ev.pointerType === 'pen' && ev.pressure > 0) return clamp(Math.pow(ev.pressure, 0.8) * (prefs.pressure / 0.6), 0.05, 1);
  return prefs.pressure;
}

// ---- pages -----------------------------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

async function blobImage(blob) {
  if (window.createImageBitmap) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeTile(tex) {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const g = c.getContext('2d');
  const img = g.createImageData(TEX, TEX);
  for (let i = 0; i < TEX * TEX; i++) {
    const v = 255 - (255 - tex.paper[i]) * 0.04;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v - 1;
    img.data[i * 4 + 2] = v - 4;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

async function openPage(id) {
  const meta = PAGES.find((p) => p.id === id) || PAGES[0];
  if (engine && page && page.id === meta.id) return;
  const token = ++loadToken;
  if (engine && engine.drawing) engine.cancel();
  await saveNow();
  $('loading').hidden = false;
  try {
    const img = await loadImage(`pages/${meta.id}.png`);
    if (token !== loadToken) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    const scratch = document.createElement('canvas');
    scratch.width = W;
    scratch.height = H;
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const px = sctx.getImageData(0, 0, W, H).data;
    const lum = new Uint8Array(W * H);
    for (let i = 0; i < lum.length; i++) lum[i] = px[i * 4];
    if (!textures) {
      textures = makeTextures();
      tile = makeTile(textures);
      $('tooth').style.backgroundImage = `url(${tile.toDataURL('image/png')})`;
    }
    const next = new Engine(W, H, textures, findRegions(lum, W, H));
    const saved = await storage.loadPage(meta.id);
    if (token !== loadToken) return;
    if (saved && saved.blob) {
      try {
        const bmp = await blobImage(saved.blob);
        sctx.clearRect(0, 0, W, H);
        sctx.drawImage(bmp, 0, 0, W, H);
        next.load(sctx.getImageData(0, 0, W, H).data);
      } catch {
        // an unreadable save just means a fresh page
      }
    }
    engine = next;
    page = meta;
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    imageData = new ImageData(engine.paint, W, H);
    ctx.putImageData(imageData, 0, 0);
    engine.update();
    savedVersion = engine.version;
    lines.src = img.src;
    sheet.style.width = `${W}px`;
    sheet.style.height = `${H}px`;
    prefs.page = meta.id;
    writePrefs();
    if (location.hash.slice(1) !== meta.id) history.replaceState(null, '', `#${meta.id}`);
    showPageInfo();
    fitView();
    sheet.classList.add('is-ready');
    updateHistoryButtons();
    document.body.dataset.ready = meta.id;
    welcome();
  } catch (err) {
    console.error(err);
    toast('Sorry, that page didn’t load. Check your connection and try again.');
  } finally {
    if (token === loadToken) $('loading').hidden = true;
  }
}

function showPageInfo() {
  const book = BOOKS[page.book];
  $('pageTitle').textContent = page.title;
  $('pageBook').textContent = book.title;
  $('pageThumb').src = `thumbs/${page.id}.png`;
  $('bookCover').src = book.cover;
  $('bookTitle').textContent = book.title;
  $('bookBlurb').textContent = book.blurb;
  $('bookBuy').href = storeLink(book, navigator.language);
  document.title = `${page.title} | M.J. Artel Colouring Studio`;
}

async function openPicker() {
  if (picker.open) return;
  const saved = await storage.savedPageIds();
  const body = $('pickerBody');
  body.replaceChildren();
  for (const [key, book] of Object.entries(BOOKS)) {
    const section = document.createElement('section');
    section.className = 'picker-book';
    const head = document.createElement('div');
    head.className = 'picker-book-head';
    const cover = new Image();
    cover.src = book.cover;
    cover.alt = '';
    const h3 = document.createElement('h3');
    h3.textContent = book.title;
    const buy = document.createElement('a');
    buy.href = storeLink(book, navigator.language);
    buy.target = '_blank';
    buy.rel = 'noopener';
    buy.textContent = 'Get the whole book';
    head.append(cover, h3, buy);
    const grid = document.createElement('div');
    grid.className = 'picker-grid';
    for (const p of PAGES.filter((pg) => pg.book === key)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-page';
      btn.classList.toggle('is-current', Boolean(page && page.id === p.id));
      const thumb = new Image();
      thumb.src = `thumbs/${p.id}.png`;
      thumb.alt = '';
      thumb.loading = 'lazy';
      const title = document.createElement('span');
      title.textContent = p.title;
      btn.append(thumb, title);
      if (saved.has(p.id)) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'In progress';
        btn.append(badge);
      }
      btn.addEventListener('click', () => {
        closePicker();
        openPage(p.id);
      });
      grid.append(btn);
    }
    section.append(head, grid);
    body.append(section);
  }
  if (typeof picker.showModal === 'function') picker.showModal();
  else picker.setAttribute('open', '');
}

function closePicker() {
  if (typeof picker.close === 'function') picker.close();
  else picker.removeAttribute('open');
}

// ---- drawing ---------------------------------------------------------------------------------------

let frameQueued = false;
function schedule() {
  if (!frameQueued) {
    frameQueued = true;
    requestAnimationFrame(frame);
  }
}

function frame() {
  frameQueued = false;
  if (!engine) return;
  const d = engine.update();
  if (d) ctx.putImageData(imageData, 0, 0, d[0], d[1], d[2] - d[0], d[3] - d[1]);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  for (const b of $$('[data-action="undo"]')) b.disabled = !engine || !engine.canUndo;
  for (const b of $$('[data-action="redo"]')) b.disabled = !engine || !engine.canRedo;
}

const pointers = new Map();
let drawId = null;
let strokeStart = 0;
let penSeen = false;
let spaceHeld = false;
let gesture = null;
let tap = null;
let sheetRect = null;

const touchPointers = () => [...pointers.values()].filter((p) => p.type === 'touch');

function toPage(ev) {
  return {
    x: ((ev.clientX - sheetRect.left) * engine.w) / sheetRect.width,
    y: ((ev.clientY - sheetRect.top) * engine.h) / sheetRect.height,
  };
}

function onDown(e) {
  if (!engine) return;
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  if (e.pointerType === 'pen') penSeen = true;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  try {
    stage.setPointerCapture(e.pointerId);
  } catch {
    // capture is a nicety
  }
  if (e.pointerType === 'touch' && touchPointers().length >= 2) {
    if (gesture && gesture.type === 'pinch') return;
    if (drawId !== null) {
      if (performance.now() - strokeStart > 350) return; // well into a line: ignore the extra finger
      engine.cancel(); // it was the start of a pinch, not a line
      drawId = null;
      schedule();
    }
    tap = null;
    startPinch();
    return;
  }
  if (gesture) return;
  if ((e.pointerType === 'mouse' && (e.button === 1 || spaceHeld)) || (e.pointerType === 'touch' && penSeen)) {
    startPan(e); // with a stylus around, fingers move the page instead of drawing
    return;
  }
  e.preventDefault();
  const tool = TOOLS[prefs.tool];
  sheetRect = sheet.getBoundingClientRect();
  const pt = toPage(e);
  if (tool.model === 'fill') {
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, pt };
    return;
  }
  drawId = e.pointerId;
  strokeStart = performance.now();
  engine.begin(tool, {
    x: pt.x, y: pt.y, pressure: pressureOf(e), rgb: hexToRgb(prefs.colour), radius: currentRadius(), clip: prefs.clip,
  });
  if (!tool.fixedColour && tool.model !== 'erase') noteRecent(prefs.colour);
  schedule();
}

function onMove(e) {
  const p = pointers.get(e.pointerId);
  if (p) {
    p.x = e.clientX;
    p.y = e.clientY;
  }
  if (gesture) {
    if (gesture.type === 'pinch') updatePinch();
    else if (gesture.id === e.pointerId) updatePan(e);
    return;
  }
  moveCursor(e);
  if (e.pointerId !== drawId) return;
  const list = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
  for (const ev of list.length ? list : [e]) {
    const pt = toPage(ev);
    engine.move(pt.x, pt.y, pressureOf(ev));
  }
  schedule();
}

function onUp(e) {
  pointers.delete(e.pointerId);
  if (tap && tap.id === e.pointerId) {
    if (e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12) fillAt(tap.pt);
    tap = null;
  }
  if (e.pointerId === drawId) {
    if (e.type === 'pointercancel') engine.cancel();
    else engine.end();
    drawId = null;
    schedule();
    afterChange();
  }
  if (gesture && ((gesture.type === 'pinch' && touchPointers().length < 2) || gesture.id === e.pointerId)) {
    gesture = null;
    stage.classList.toggle('is-panning', spaceHeld);
  }
}

function fillAt(pt) {
  const look = lookTool(prefs.look);
  if (engine.fill(pt.x, pt.y, look, { rgb: hexToRgb(prefs.colour), pressure: prefs.pressure })) {
    noteRecent(prefs.colour);
    schedule();
    afterChange();
  } else {
    toast('Tap inside a shape to fill it.');
  }
}

// ---- zoom and pan ----------------------------------------------------------------------------------

function applyView() {
  if (!engine) return;
  const r = stage.getBoundingClientRect(), keep = 80;
  const w = engine.w * view.s, h = engine.h * view.s;
  view.tx = clamp(view.tx, keep - w, r.width - keep);
  view.ty = clamp(view.ty, keep - h, r.height - keep);
  sheet.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
  updateSizeDot();
  updateCursorShape();
}

function fitView() {
  if (!engine) return;
  const r = stage.getBoundingClientRect(), m = r.width < 600 ? 10 : 28;
  view.fit = Math.max(0.05, Math.min((r.width - 2 * m) / engine.w, (r.height - 2 * m) / engine.h));
  view.s = view.fit;
  view.tx = (r.width - engine.w * view.s) / 2;
  view.ty = (r.height - engine.h * view.s) / 2;
  view.zoomed = false;
  applyView();
}

function zoomAt(factor, cx, cy) {
  const s = clamp(view.s * factor, view.fit * 0.8, view.fit * 8);
  view.tx = cx - ((cx - view.tx) * s) / view.s;
  view.ty = cy - ((cy - view.ty) * s) / view.s;
  view.s = s;
  view.zoomed = true;
  applyView();
}

function zoomBy(factor) {
  const r = stage.getBoundingClientRect();
  zoomAt(factor, r.width / 2, r.height / 2);
}

function startPinch() {
  const [a, b] = touchPointers(), r = stage.getBoundingClientRect();
  gesture = {
    type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, s0: view.s, tx0: view.tx, ty0: view.ty,
  };
  cursorEl.hidden = true;
}

function updatePinch() {
  const t = touchPointers();
  if (t.length < 2) return;
  const [a, b] = t, r = stage.getBoundingClientRect(), g = gesture;
  const s = clamp((g.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0, view.fit * 0.8, view.fit * 8);
  const px = (g.mx - g.tx0) / g.s0, py = (g.my - g.ty0) / g.s0; // the page point that started under the fingers
  view.s = s;
  view.tx = (a.x + b.x) / 2 - r.left - px * s;
  view.ty = (a.y + b.y) / 2 - r.top - py * s;
  view.zoomed = true;
  applyView();
}

function startPan(e) {
  gesture = { type: 'pan', id: e.pointerId, x0: e.clientX, y0: e.clientY, tx0: view.tx, ty0: view.ty };
  stage.classList.add('is-panning');
  cursorEl.hidden = true;
}

function updatePan(e) {
  view.tx = gesture.tx0 + e.clientX - gesture.x0;
  view.ty = gesture.ty0 + e.clientY - gesture.y0;
  view.zoomed = true;
  applyView();
}

function onWheel(e) {
  if (!engine) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
  if (e.shiftKey && !e.ctrlKey) {
    view.tx -= (e.deltaY || e.deltaX) * unit;
    view.zoomed = true;
    applyView();
    return;
  }
  zoomAt(Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
}

// ---- brush outline that follows the mouse or stylus ------------------------------------------------

let cursorAngle = 0;
function updateCursorShape() {
  const t = TOOLS[prefs.tool];
  if (!t.size || !engine) {
    cursorEl.hidden = true;
    return;
  }
  const r = Math.max(2, currentRadius() * view.s);
  const rb = t.chisel ? Math.max(1.5, r * t.chisel.aspect) : r;
  cursorEl.style.width = `${2 * r}px`;
  cursorEl.style.height = `${2 * rb}px`;
  cursorAngle = t.chisel ? t.chisel.angle : 0;
}

function moveCursor(e) {
  if (e.pointerType === 'touch' || !TOOLS[prefs.tool].size) {
    cursorEl.hidden = true;
    return;
  }
  const r = stage.getBoundingClientRect();
  const w = parseFloat(cursorEl.style.width) || 0, h = parseFloat(cursorEl.style.height) || 0;
  cursorEl.style.transform = `translate(${e.clientX - r.left - w / 2}px, ${e.clientY - r.top - h / 2}px) rotate(${cursorAngle}deg)`;
  cursorEl.hidden = false;
}

// ---- history, saving, exporting --------------------------------------------------------------------

function afterChange() {
  updateHistoryButtons();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
}

function doUndo() {
  if (engine && !engine.drawing && engine.undo()) {
    schedule();
    afterChange();
  }
}

function doRedo() {
  if (engine && !engine.drawing && engine.redo()) {
    schedule();
    afterChange();
  }
}

function startOver() {
  if (engine && !engine.drawing && engine.clear()) {
    schedule();
    afterChange();
    toast('Page cleared. Press Undo to bring it back.');
  }
}

async function saveNow() {
  clearTimeout(saveTimer);
  const eng = engine, pg = page;
  if (!eng || !pg || eng.drawing || eng.version === savedVersion) return;
  const version = eng.version;
  frame();
  if (eng.isBlank()) {
    await storage.removePage(pg.id);
  } else {
    const blob = await new Promise((resolve) => {
      try {
        canvas.toBlob(resolve, 'image/png');
      } catch {
        resolve(null);
      }
    });
    if (!blob || !(await storage.savePage(pg.id, blob))) return;
  }
  if (engine === eng) savedVersion = version;
}

function siteLabel() {
  if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return '';
  return (location.host + location.pathname.replace(/color\/.*$/, '')).replace(/\/$/, '');
}

function fitFont(c, text, weight, size, family, maxWidth) {
  let s = size;
  c.font = `${weight} ${s}px ${family}`;
  while (s > 8 && c.measureText(text).width > maxWidth) {
    s *= 0.92;
    c.font = `${weight} ${s}px ${family}`;
  }
}

// The finished picture: paper, colour, line art, and a small credit band underneath.
async function composite() {
  try {
    await document.fonts.ready;
  } catch {
    // fall back to whatever fonts are ready
  }
  frame();
  const W = engine.w, H = engine.h, band = Math.round(Math.max(W, H) * 0.085), pad = Math.round(band * 0.42);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H + band;
  const c = out.getContext('2d');
  c.fillStyle = '#fffdf8';
  c.fillRect(0, 0, W, H + band);
  c.drawImage(canvas, 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.drawImage(lines, 0, 0, W, H);
  c.fillStyle = c.createPattern(tile, 'repeat');
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#f3ead8';
  c.fillRect(0, H, W, band);
  c.fillStyle = '#e2d3b4';
  c.fillRect(0, H, W, 2);
  const book = BOOKS[page.book];
  const title = `${page.title} · ${book.title}`;
  const credit = `A colouring book by M.J. Artel${siteLabel() ? ` · ${siteLabel()}` : ''}`;
  c.textBaseline = 'middle';
  c.fillStyle = '#2b2620';
  fitFont(c, title, 600, band * 0.3, 'Fraunces, Georgia, serif', W - 2 * pad);
  c.fillText(title, pad, H + band * 0.38);
  c.fillStyle = '#6b6257';
  fitFont(c, credit, 600, band * 0.2, '"Nunito Sans", system-ui, sans-serif', W - 2 * pad);
  c.fillText(credit, pad, H + band * 0.72);
  return out;
}

const toBlob = (c) => new Promise((resolve, reject) => {
  try {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a picture'))), 'image/png');
  } catch (err) {
    reject(err);
  }
});

function bookNudge(verb) {
  const book = BOOKS[page.book];
  toast([`${verb} Love this page? There’s more in `, link(book.title, storeLink(book, navigator.language)), '.'], 7000);
}

async function savePicture() {
  if (!engine) return;
  try {
    const blob = await toBlob(await composite());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mj-artel-${page.id}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    bookNudge('Saved!');
  } catch (err) {
    console.error(err);
    toast('Sorry, the picture couldn’t be saved on this device.');
  }
}

async function printPicture() {
  if (!engine) return;
  try {
    const blob = await toBlob(await composite());
    const img = $('printImg');
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
    await img.decode();
    window.print();
    bookNudge('Printed!');
  } catch (err) {
    console.error(err);
    toast('Sorry, printing didn’t work on this device.');
  }
}

// ---- small things ----------------------------------------------------------------------------------

function link(text, href) {
  const a = document.createElement('a');
  a.textContent = text;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

let toastTimer = 0;
function toast(content, ms = 4000) {
  const el = $('toast');
  el.replaceChildren(...[].concat(content));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function welcome() {
  if (prefs.welcomed) return;
  prefs.welcomed = true;
  writePrefs();
  const fine = window.matchMedia('(pointer: fine)').matches;
  toast(fine
    ? 'Pick an art supply and start colouring. Scroll to zoom; hold Space and drag to move the page.'
    : 'Pick an art supply and start colouring. Pinch with two fingers to zoom and move the page.', 7000);
}

function onKey(e) {
  const t = e.target;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) doRedo();
    else doUndo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    doRedo();
    return;
  }
  if (mod || e.altKey || picker.open) return;
  if (t.matches && t.matches('select, textarea, input:not([type="radio"]):not([type="checkbox"])')) return;
  if (e.key === ' ') {
    spaceHeld = true;
    stage.classList.add('is-panning');
    if (!t.closest || !t.closest('button, summary, a, label')) e.preventDefault();
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= TOOL_ORDER.length) selectTool(TOOL_ORDER[n - 1]);
  else if (e.key === '[' || e.key === ']') nudgeSize(e.key === '[' ? -6 : 6);
  else if (e.key === '+' || e.key === '=') zoomBy(1.25);
  else if (e.key === '-' || e.key === '_') zoomBy(0.8);
  else if (e.key === '0') fitView();
  else if (e.key.toLowerCase() === 'l') {
    const clip = $('clip');
    clip.checked = !clip.checked;
    clip.dispatchEvent(new Event('change'));
    toast(clip.checked ? 'Staying inside the lines.' : 'Colouring freely (lines off).', 1800);
  }
}

// ---- start -----------------------------------------------------------------------------------------

function start() {
  buildIcons();
  buildTools();
  buildPalettes();
  buildSettings();
  setColour(prefs.colour);
  selectTool(prefs.tool);

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('pointerleave', () => (cursorEl.hidden = true));
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      spaceHeld = false;
      if (!gesture) stage.classList.remove('is-panning');
    }
  });

  const actions = {
    undo: doUndo, redo: doRedo, zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(0.8), fit: fitView,
    save: savePicture, print: printPicture, clear: startOver, pages: openPicker, closePicker,
  };
  document.addEventListener('click', (e) => {
    for (const menu of $$('details.menu[open]')) if (!menu.contains(e.target)) menu.open = false;
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const menu = el.closest('details');
    if (menu) menu.open = false;
    const run = actions[el.dataset.action];
    if (run) run();
  });
  picker.addEventListener('click', (e) => {
    if (e.target === picker) closePicker(); // a click on the backdrop
  });

  new ResizeObserver(() => {
    if (!engine) return;
    if (view.zoomed) applyView();
    else fitView();
  }).observe(stage);

  window.addEventListener('hashchange', () => openPage(location.hash.slice(1)));
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });

  const wanted = location.hash.slice(1);
  openPage(PAGES.some((p) => p.id === wanted) ? wanted : prefs.page);
}

start();
