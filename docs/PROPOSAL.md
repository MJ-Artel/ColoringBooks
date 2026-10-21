# M.J. Artel website: plan

**Status:** approved by Andre (ages 4–10, "and any age can enjoy them"; email via MailerLite). Built with Astro;
see the README for how it's put together and what's still to switch on.

## Positioning

M.J. Artel is an independent author-illustrator of story-led colouring books. There are three books, and
**The Wildwood Games** leads: it's the newest, the strongest design, and it has the most distinctive story.
The site should feel like a small creative studio that happens to sell books, not like a list of Amazon links.
It works as a funnel: useful pages and free things bring visitors in, previews and the studio build trust,
the book pages make the case, and Amazon closes the sale.

Who it's for: parents, grandparents, teachers and gift-buyers of kids aged about 4–10.

## 1. Sitemap

```
/                                      Home
/wildwood-games-coloring-book/         Book page (lead book)
/robot-coloring-book/                  Book page
/cars-coloring-book/                   Book page
/color/                                Colouring Studio (app; deep links like /color/#wildwood-29)
/free-coloring-pages/                  Free pack, single-page previews, email sign-up
/blog/                                 Articles
/blog/<article-slug>/                  One article
/about/                                About M.J. Artel
/contact/                              Contact + newsletter
/privacy/                              Privacy, cookies (none), Amazon Associates disclosure
```

Each book page has: a hero with the cover, age range and page count; 6–8 interior previews with captions; "what
makes it different"; a link into the studio with that book's pages; an FAQ (size, paper, ages, bleed-through);
and **one** clear Amazon button that follows the visitor's country, with the other stores in small print.

## 2. Homepage wireframe

```
+--------------------------------------------------------------------------+
| M.J. Artel                Books   Colour online   Free pages   Blog      |  cream bar, thin wood rule
+--------------------------------------------------------------------------+
|  Story-led colouring books               [ Wildwood cover, slight tilt ] |
|  for curious kids                                                        |
|  One line about the books + M.J. Artel                                   |
|  [ Buy The Wildwood Games ]  [ Colour a page online ]                    |
|  Also on Amazon.ca · Amazon.co.uk                                        |
+--------------------------------------------------------------------------+
|  THE BOOKS: three equal cards, Wildwood first with a "Newest" ribbon     |
|  [cover]  title · ages · pages · one-line hook · [See inside]            |
+--------------------------------------------------------------------------+
|  COLOURING STUDIO band                                                   |
|  [ studio screenshot ]   supplies list   [ Open the Colouring Studio ]   |
+--------------------------------------------------------------------------+
|  FREE COLOURING PACK: 6 pages from all three books                       |
|  [ email field ][ Send me the pack ]   or: one free page, no sign-up     |
+--------------------------------------------------------------------------+
|  FROM THE BLOG: three latest articles as cards                           |
+--------------------------------------------------------------------------+
|  ABOUT: M.J. Artel's mark, two sentences, [ About M.J. Artel ]           |
+--------------------------------------------------------------------------+
| Books · Studio · Free pages · About · Contact · Privacy                  |
| "As an Amazon Associate I earn from qualifying purchases."               |
+--------------------------------------------------------------------------+
```

Mobile: the same order in one column. The hero cover moves above the headline at a smaller size, and the
Buy button stays visible without scrolling.

## 3. Colour and type system

The Colouring Studio already uses this system, so you can see it in action at `/color/`.

| Token | Hex | Used for |
|---|---|---|
| cream | `#f6efe0` | page background |
| paper | `#fffdf8` | cards, panels |
| sand | `#e7d9bf` | borders, dividers |
| wood | `#c99868` → `#8f5f37` | accents, rules, the tool tray, small illustrations |
| moss | `#5e7d55` | primary buttons (white text) |
| moss-dark | `#45613f` | links, hover states |
| honey | `#f2c14e` | the Buy button (dark text): warm and easy to spot |
| ink | `#2b2620` | body text |
| muted | `#6b6257` | captions, secondary text |

Contrast, checked against WCAG: ink on cream 13.1:1, muted on cream 5.2:1, white on moss 4.6:1,
moss-dark on paper 6.8:1, ink on honey 8.9:1. All of them pass AA for normal text.

The Wildwood team colours stay as accents on the Wildwood pages only: Wolves `#6d7b8d`, Bears `#8a5a3b`,
Eagles `#3a6ea5`, Foxes `#d9772b`.

**Type**

- Headings: **Fraunces** (600/700), a warm, slightly storybook serif with an editorial feel.
- Text and buttons: **Nunito Sans** (400/600/800), round and friendly, and very readable.
- Both fonts are self-hosted, so nothing is fetched from Google (better for privacy on a kids' site, and faster).
- Scale: body 17px (articles 18px) with a 1.25 ratio: 14 · 17 · 21 · 26 · 33 · 41 · 51. Articles run 60–72 characters per line.

**Visual style:** flat 2D, using the books' own line art as decoration (a fox ear here, a robot antenna there).
Generous whitespace, soft paper shadows, no stock photos.

## 4. URL structure

- Lowercase words joined by hyphens, with trailing slashes and no dates (`/blog/field-day-activities-for-kids/`).
- URLs use the US spelling **coloring**, because that's what people search for. Page text keeps M.J. Artel's
  Canadian spelling (colouring), as the books do.
- Book pages sit at the root with keyword slugs (see the sitemap). Articles live under `/blog/`.
- Studio deep links: `/color/#<page-id>`, used from every book preview and article image.
- Every page gets a canonical URL. When the custom domain arrives, Astro's `site`/`base` settings change in one
  place, and GitHub Pages redirects the old `mj-artel.github.io/ColoringBooks/...` addresses to the new domain.

## 5. First five SEO articles

All three books are covered, with Wildwood leading. Each article answers its question in the first two
sentences, uses the books' own art (no thin lists of links), links to one book page and into the studio, and
gets Article + BreadcrumbList structured data. An FAQ block (and FAQPage data) appears only where the
questions are real.

| # | Working title | Main searches | Book |
|---|---|---|---|
| 1 | Field Day Activities for Kids: 12 Wildwood Games Ideas (with Free Printables) | field day activities for kids, sports day ideas | Wildwood |
| 2 | Teamwork and Sportsmanship Activities for Kids (Classroom-Ready) | sportsmanship activities for kids, teamwork activities | Wildwood |
| 3 | Free Woodland Animal Coloring Pages: Fox, Bear, Wolf and Eagle | woodland animal coloring pages, fox coloring page | Wildwood |
| 4 | Robot Coloring Pages for Kids, with a Story to Read Along | robot coloring pages for kids, robot coloring book | Robot |
| 5 | Car Coloring Pages for Kids Who Love Cars | car coloring pages, classic car coloring pages | Cars |

Next in line: robot birthday party activities, gifts for kids who love drawing, how colouring helps kids focus,
and screen-light activities for kids who love machines. Timing: field day season is May–June, so article 1
should go out by early May. Back-to-school (August) suits article 2.

## 6. Colouring Studio

**Built and live** (`/color/`):

- 16 pages: 8 Wildwood, 4 Robot, 4 Cars.
- Supplies: pencil crayon, wax crayon, watercolour, felt tip, alcohol marker (chisel tip), glitter gel pen,
  graphite pencil, paint bucket (fills with paint, pencil, crayon, watercolour, marker or glitter) and eraser.
- Pressure (the slider, or a stylus) and "stay inside the lines".
- Four colour sets plus your own colours, with a recently-used row.
- Undo/redo and zoom (pinch, scroll or buttons).
- Autosave in the visitor's own browser.
- Save picture or print. Both add a credit band naming the page, the book and M.J. Artel.
- A page picker with links to each book, and a book card beside every page.
- Works on phones, tablets (including Apple Pencil) and desktops. No accounts, and nothing is uploaded.

**Proposed next: a game layer (needs your OK)**

1. **Wildwood medals.** Colour every shape on a Wildwood page to win a medal for your team (Wolves, Bears,
   Eagles or Foxes). Medals collect on a shelf in the studio, which gives kids a reason to come back and meet
   more pages.
2. **Team colours.** A colour set for each team, chosen on the "Make a team symbol" page.
3. **Share card.** A square picture made for Pinterest and Instagram with the book credit, for parents to post.
4. **Page of the week.** One new studio page each week, announced by email, which feeds the list.

## 7. Free pack and email

The free pack is built: 6 pages plus a cover page with all three books (`assets/mj-artel-free-colouring-pack.pdf`).
For now it's a plain download. Once there's an email service:

- One page stays free with no sign-up (good for Pinterest and search).
- The full pack, and later the page of the week, comes by email.
- Use the free tier of **MailerLite**, **Kit** or **Buttondown**. The sign-up is for adults (parents and
  teachers), with a consent checkbox, an unsubscribe link and a mailing address, as Canada's anti-spam law
  (CASL) requires.

## 8. Amazon, tracking, privacy

- The Buy buttons already follow the visitor: amazon.com by default, amazon.ca for Canadian browsers and
  amazon.co.uk for UK browsers where a UK listing exists.
- **Amazon Associates:** apply once the site has some traffic. A new account needs 3 qualifying sales within
  180 days. Associate links may not go in emails or PDFs. The footer carries the required disclosure. OneLink
  can later send international visitors to their own store automatically.
- **Analytics:** a cookie-free counter such as Cloudflare Web Analytics (free, so no cookie banner is needed),
  counting page views and clicks on Buy buttons.
- **Kids' privacy:** no accounts, no tracking cookies, studio drawings stay on the device, and email sign-up is
  for adults only.

## 9. Build plan (after approval)

- **Astro** (current release), static output, with content collections for `books` and `articles` (Markdown with typed frontmatter).
- The studio is copied as-is into `public/color/`. It's already plain static files and needs no build step.
- **GitHub Actions** builds on every push to `main` and deploys to Pages. CI also runs `npm test` (the studio
  engine) and `npm run smoke` (browser checks).
- Astro's image pipeline makes WebP/AVIF images with JPEG fallbacks. Fonts are self-hosted.
- SEO plumbing:
  - `sitemap.xml` and `robots.txt`, plus a canonical URL and Open Graph/Twitter cards on every page.
  - JSON-LD for `Book` (author M.J. Artel, illustrations, page count, age range), `Person`/`Organization`,
    `BreadcrumbList`, and `Article`, with `FAQPage` only where the FAQ is visible.
- WCAG 2.2 AA: keyboard navigation, visible focus, alt text written for every preview, and reduced motion respected.

## 10. Decisions needed

1. **Sitemap and URLs:** approve, or adjust the book-page slugs.
2. **Look:** approve Fraunces + Nunito Sans and the cream/wood/moss/honey palette. The current one-page site
   still uses the older Fredoka look; the rebuild switches it over.
3. **Articles:** approve the first five, or swap any.
4. **Email service:** MailerLite, Kit or Buttondown (or decide later and keep the plain download).
5. **Wildwood listing:** amazon.com uses ASIN `B0GMQHKPHF` and amazon.ca uses `B0GNZSL2VB`, while the other two
   books share one ASIN across stores. Are these two formats (paperback and hardcover?) or two editions? Is
   there a UK listing?
6. **Book facts** for the book pages: age range, page count and trim size for each book.
7. **Studio pages:** 16 pages (about one picture in seven across the books, and 8 of Wildwood's 30-odd) can be
   coloured free online. Happy with that number and that choice?
8. **Game layer:** build Wildwood medals next?
