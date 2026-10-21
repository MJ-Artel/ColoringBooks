// Structured data (JSON-LD). Only describes what is visible on the page.

import { href } from './paths';

export const author = (site: URL | undefined) => ({
  '@type': 'Person',
  name: 'M.J. Artel',
  url: new URL(href('about/'), site).toString(),
});

export const breadcrumbs = (trail: { name: string; path: string }[], site: URL | undefined) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'Home', path: '' }, ...trail].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: new URL(href(c.path), site).toString(),
  })),
});

export const faqPage = (items: { q: string; a: string }[]) =>
  items.length
    ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }]
    : [];
