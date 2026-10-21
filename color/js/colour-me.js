// A picture visitors can colour right on a page of the website: one studio page, a few wax crayons and the
// paint bucket. It uses the Colouring Studio's own engine, and saves the picture where the studio looks for
// it, so "Keep colouring in the Studio" opens the same page just as the visitor left it.
//
// Markup (src/components/ColourMe.astro):
//   [data-colour-me data-page]  .sheet > img.paint (starting colours) + canvas + img.lines
//   [data-crayon="#hex"] radios, [data-undo], [data-clear], [data-studio] link, [data-hint]
import { makeTextures } from './textures.js';
import { findRegions } from './regions.js';
import { Engine } from './engine.js';
import { lookTool } from './brushes.js';
import * as storage from './storage.js';

const CRAYON = lookTool('crayon');
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const decoded = (img) =>
  img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise((resolve, reject) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', reject, { once: true });
      });
let textures = null;

for (const fig of document.querySelectorAll('[data-colour-me]')) setUp(fig);

function setUp(fig) {
  const id = fig.dataset.page;
  const sheet = fig.querySelector('.sheet');
  const lines = fig.querySelector('.lines');
  const startImg = fig.querySelector('.paint');
  const canvas = fig.querySelector('canvas');
  const crayons = [...fig.querySelectorAll('[data-crayon]')];
  const undo = fig.querySelector('[data-undo]');
  const clear = fig.querySelector('[data-clear]');
  const studio = fig.querySelector('[data-studio]');
  const hint = fig.querySelector('[data-hint]');

  let engine = null;
  let ctx = null;
  let imageData = null;
  let booting = null;
  let touched = false;
  let saveTimer = 0;
  let saving = Promise.resolve();
  let rgb = hexRgb((crayons.find((c) => c.getAttribute('aria-checked') === 'true') || crayons[0]).dataset.crayon);

  const wake = () => (booting ??= boot().catch(() => fig.classList.add('is-broken')));

  async function boot() {
    await Promise.all([decoded(lines), decoded(startImg)]);
    const W = lines.naturalWidth, H = lines.naturalHeight;
    const scratch = document.createElement('canvas');
    scratch.width = W;
    scratch.height = H;
    const g = scratch.getContext('2d', { willReadFrequently: true });
    g.drawImage(lines, 0, 0);
    const px = g.getImageData(0, 0, W, H).data;
    const lum = new Uint8Array(W * H);
    for (let i = 0; i < lum.length; i++) lum[i] = px[i * 4];
    textures ??= makeTextures();
    const e = new Engine(W, H, textures, findRegions(lum, W, H));

    // The visitor's own colouring if they have some, otherwise the picture as it was started for them.
    g.clearRect(0, 0, W, H);
    let from = startImg;
    const saved = await storage.loadPage(id);
    if (saved && saved.blob) {
      try {
        from = await createImageBitmap(saved.blob);
      } catch {
        // an unreadable save just means the starting picture
      }
    }
    g.drawImage(from, 0, 0, W, H);
    e.load(g.getImageData(0, 0, W, H).data);

    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    imageData = new ImageData(e.paint, W, H);
    ctx.putImageData(imageData, 0, 0);
    e.update();
    engine = e;
    canvas.hidden = false;
    startImg.hidden = true;
    fig.classList.add('is-live');
  }

  function show() {
    const d = engine.update();
    if (d) ctx.putImageData(imageData, 0, 0, d[0], d[1], d[2] - d[0], d[3] - d[1]);
    undo.disabled = !engine.canUndo;
    clear.disabled = engine.isBlank();
  }

  const say = (key) => {
    if (hint && hint.dataset[key]) hint.textContent = hint.dataset[key];
  };

  // The picture goes where the studio keeps it; a blank page is simply forgotten, as in the studio.
  const store = () =>
    new Promise((resolve) => {
      if (engine.isBlank()) {
        storage.removePage(id).then(resolve);
        return;
      }
      try {
        canvas.toBlob(async (blob) => {
          if (blob) await storage.savePage(id, blob);
          resolve();
        }, 'image/png');
      } catch {
        resolve();
      }
    });

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saving = saving.then(store);
    }, 300);
  }

  // Taps colour a shape; drags are left alone so the page still scrolls on phones.
  let down = null;
  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    wake();
  });
  sheet.addEventListener('pointercancel', () => (down = null));
  sheet.addEventListener('pointerup', async (ev) => {
    if (!down || down.id !== ev.pointerId || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 10) {
      down = null;
      return;
    }
    down = null;
    await wake();
    if (!engine) return;
    const r = sheet.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * engine.w;
    const y = ((ev.clientY - r.top) / r.height) * engine.h;
    if (!engine.fill(x, y, CRAYON, { rgb, pressure: 0.9 })) return;
    show();
    say('after');
    touched = true;
    save();
  });

  undo.addEventListener('click', () => {
    if (!engine || !engine.undo()) return;
    show();
    save();
  });

  // Start over: a blank page, with Undo to bring the picture back (as in the studio).
  clear.addEventListener('click', async () => {
    await wake();
    if (!engine || !engine.clear()) return;
    show();
    say('cleared');
    touched = true;
    save();
  });

  // Crayons are a radio group: click to pick, arrow keys to move along the box.
  const pick = (c, focus) => {
    for (const o of crayons) {
      const on = o === c;
      o.setAttribute('aria-checked', String(on));
      o.tabIndex = on ? 0 : -1;
    }
    rgb = hexRgb(c.dataset.crayon);
    if (focus) c.focus();
    wake();
  };
  crayons.forEach((c, i) => {
    c.addEventListener('click', () => pick(c, false));
    c.addEventListener('keydown', (ev) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
      if (!step) return;
      ev.preventDefault();
      pick(crayons[(i + step + crayons.length) % crayons.length], true);
    });
  });

  // Save before leaving for the studio, so the picture is there when it opens.
  studio.addEventListener('click', async (ev) => {
    if (!touched || !engine) return;
    ev.preventDefault();
    clearTimeout(saveTimer);
    await saving;
    await store();
    location.href = studio.href;
  });

  // Get the engine ready once the picture is nearly on screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          (window.requestIdleCallback || setTimeout)(wake);
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(fig);
  } else {
    wake();
  }
}
