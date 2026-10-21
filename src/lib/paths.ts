// Links that work under the GitHub Pages sub-path today and at the root of a custom domain later.

const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Site-relative link: href('blog/') -> '/blog/' */
export const href = (path = '') => `${base}/${path.replace(/^\/+/, '')}`;

/** Absolute URL for canonical links, social cards and structured data. */
export const absolute = (path: string, site: URL | undefined) => new URL(href(path), site).toString();
