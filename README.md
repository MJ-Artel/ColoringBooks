# M.J. Artel Colouring Books

The website for M.J. Artel's colouring books (The Wildwood Games, the Robot Coloring Book and the Cars Coloring
Book), served by GitHub Pages from the root of `main`.

- `index.html`, `style.css`: the current one-page site.
- `color/`: the **Colouring Studio**, where visitors colour book pages in the browser. Plain static files and ES
  modules, no build step. Deep link to a page with `color/#wildwood-29`.
- `assets/`: covers, page previews, the studio screenshot and the free colouring pack (PDF).
- `docs/PROPOSAL.md`: the plan for the full site (sitemap, design system, URLs, first articles), waiting for approval.

## Colouring Studio

| File | What it does |
|---|---|
| `color/js/engine.js` | Paint layer, brush strokes, fills, undo. Pure JavaScript over typed arrays (no DOM). |
| `color/js/brushes.js` | The art supplies and their settings. |
| `color/js/regions.js` | Finds the shapes between the lines (paint bucket, "stay inside the lines"). |
| `color/js/textures.js` | Paper tooth, crayon, watercolour and glitter textures. |
| `color/js/app.js` | Wires everything to the page: pointer and touch input, zoom, palettes, saving, printing. |
| `color/js/pages.js` | The books, their Amazon links and the pages offered. |
| `color/pages/`, `color/thumbs/` | Cleaned line art (1200 px) and picker thumbnails. |

To add a page: render it from the interior PDF, clean it up the same way (levels, trim, 1200 px PNG and
thumbnail), drop the files into `color/pages/` and `color/thumbs/`, and add an entry to `PAGES` in `pages.js`.

## Running it locally

```sh
python3 -m http.server      # then open http://localhost:8000/ and /color/
npm test                    # engine tests (Node 20+)
npm run smoke               # browser checks + screenshots in test-output/ (needs Playwright)
```
