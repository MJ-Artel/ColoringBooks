# M.J. Artel Colouring Books

The website for M.J. Artel's colouring books (The Wildwood Games, the Robot Coloring Book and the Cars Coloring
Book): an [Astro](https://astro.build) site plus the **Colouring Studio**, where visitors colour book pages in the
browser. Published to GitHub Pages by GitHub Actions.

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
npm run dev        # http://localhost:4321/ColoringBooks/
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

## Going live: switches to flip

1. **Publish with GitHub Actions (one time):** Settings → Pages → Build and deployment → Source:
   **GitHub Actions**. Until then GitHub keeps serving the old one-page site from the repository, and the
   workflow's deploy step waits. After the switch, re-run the latest workflow (Actions → Build and deploy the
   site → Run workflow), or push anything. Then the old `index.html` and `style.css` at the repository root can go.
2. **Email sign-up (MailerLite):** create a group (e.g. "Free colouring pack") and an embedded form for it, with
   double opt-in on. In the form's HTML code, the action address looks like
   `https://assets.mailerlite.com/jsonp/<accountId>/forms/<formId>/subscribe`; put both numbers in
   `src/data/site.ts`. Add an automation that emails the pack link to new members of the group. The site switches
   from the plain download to the sign-up form automatically.
3. **Contact page:** set `contactEmail` in `src/data/site.ts`. The page appears in the footer and in search.
4. **Amazon Associates:** after joining, set `amazonAssociate: true` (adds the disclosure) and swap the store links
   in `color/js/pages.js` for your tagged links.
5. **Custom domain:** point the domain at GitHub Pages (Settings → Pages → Custom domain shows the DNS records),
   then in `astro.config.mjs` set `site` to the domain and `base` to `'/'`, and update `public/robots.txt`.
