# M.J. Artel Colouring Books

The website for M.J. Artel's colouring books (The Wildwood Games, the Robot Coloring Book and the Cars Coloring
Book): an [Astro](https://astro.build) site plus the **Colouring Studio**, where visitors colour book pages in the
browser. Published to GitHub Pages by GitHub Actions on every push to `main`.

## What's where

| Path | What it is |
|---|---|
| `src/pages/` | Home, book pages (`[book].astro`), free colouring pages, blog, about, contact, privacy, 404 |
| `src/content/books/` | One Markdown file per book: facts, preview pictures, features, FAQ and the story |
| `src/content/articles/` | Blog articles (Markdown) |
| `src/components/`, `src/layouts/` | Building blocks: Buy button, book card, gallery, FAQ, studio band, free pack, email sign-up |
| `src/data/site.ts` | Site settings: **MailerLite form, contact email, Amazon Associates, analytics** |
| `src/styles/global.css` | Design system (colours, type, buttons) shared with the studio |
| `color/` | The Colouring Studio: plain static files and ES modules, no build step |
| `color/js/pages.js` | The books' **Amazon links** and the studio's pages. Used by the studio and the website. |
| `assets/` | Covers, page previews, the studio screenshot and the free PDFs |
| `docs/PROPOSAL.md` | The approved plan (sitemap, design system, URLs, articles) |

`color/` and `assets/` live at the repository root and are copied into `public/` at build time
(`scripts/sync-public.mjs`), so there's one copy of each file.

## Working on it

```sh
npm install
npm run dev        # http://localhost:4321/
npm test           # studio engine tests
npm run build      # site in dist/
npm run smoke      # browser checks + screenshots in test-output/ (after a build; needs `npx playwright install chromium`)
```

Every push runs the tests, the build and the browser checks in GitHub Actions (`.github/workflows/site.yml`).
Pushes to `main` publish the site.

### Adding things

- **An article:** add `src/content/articles/<url-slug>.md` (copy the field-day article's front matter). Set
  `draft: true` to keep it unpublished.
- **A studio page:** render the page from the interior PDF, clean it up (levels, trim, 1200 px PNG plus a 260 px
  thumbnail), put the files in `color/pages/` and `color/thumbs/`, and add it to `PAGES` in `color/js/pages.js`.
- **A translated edition:** add it to `editions` in the book's Markdown file.

## Switches to flip

The site publishes from GitHub Actions (Settings → Pages → Source: GitHub Actions). The rest switch on from
`src/data/site.ts` and friends:

1. **Email sign-up (MailerLite):** create a group (e.g. "Free colouring pack") and an embedded form for it, with
   double opt-in on. In the form's HTML code, the action address looks like
   `https://assets.mailerlite.com/jsonp/<accountId>/forms/<formId>/subscribe`; put both numbers in
   `src/data/site.ts`. Add an automation that emails the pack link to new members of the group. The site switches
   from the plain download to the sign-up form automatically.
2. **Contact page:** set `contactEmail` in `src/data/site.ts`. The page appears in the footer and in search.
3. **Amazon Associates:** after joining, set `amazonAssociate: true` (adds the disclosure) and swap the store links
   in `color/js/pages.js` for your tagged links.
4. **Analytics:** set `cloudflareBeacon` to a Cloudflare Web Analytics token (cookie-free, so no banner needed).
5. **Domain:** the site lives at https://mjartel.fyi (DNS at Porkbun, set in Settings → Pages → Custom domain).
