// Copies the Colouring Studio (color/) and the shared images and downloads (assets/) into public/,
// so Astro ships them unchanged at /color/ and /assets/. The folders at the repository root stay the
// single source; the copies in public/ are generated and ignored by git.

import { cp, rm } from 'node:fs/promises';

const root = new URL('..', import.meta.url);

for (const dir of ['color', 'assets']) {
  const target = new URL(`public/${dir}/`, root);
  await rm(target, { recursive: true, force: true });
  await cp(new URL(`${dir}/`, root), target, { recursive: true });
}
console.log('synced color/ and assets/ into public/');
