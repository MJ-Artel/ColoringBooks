// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages serves the site from /ColoringBooks/ until a custom domain is attached.
// When it is: set `site` to the domain (e.g. 'https://mjartel.com'), set `base` to '/', and add public/CNAME.
export default defineConfig({
  site: 'https://mj-artel.github.io',
  base: '/ColoringBooks',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !/\/(404|contact)\/?$/.test(page),
    }),
  ],
});
