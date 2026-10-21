import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const faq = z.array(z.object({ q: z.string(), a: z.string() })).default([]);

// One file per book. `key` matches the book in color/js/pages.js, which holds the Amazon links
// shared with the Colouring Studio.
const books = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/books' }),
  schema: ({ image }) =>
    z.object({
      key: z.enum(['wildwood', 'robot', 'cars']),
      order: z.number(),
      title: z.string(),
      fullTitle: z.string(),
      seoTitle: z.string(),
      description: z.string(),
      hook: z.string(),
      ages: z.string(),
      pageCount: z.number(),
      pictures: z.string(),
      trim: z.string(),
      newest: z.boolean().default(false),
      cover: image(),
      coverAlt: z.string(),
      features: z.array(z.object({ title: z.string(), text: z.string() })),
      previews: z.array(
        z.object({
          image: image(),
          caption: z.string(),
          alt: z.string(),
          studio: z.string().optional(),
        }),
      ),
      editions: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
      faq,
    }),
});

const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().optional(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      book: z.enum(['wildwood', 'robot', 'cars']),
      hero: image(),
      heroAlt: z.string(),
      draft: z.boolean().default(false),
      faq,
    }),
});

export const collections = { books, articles };
