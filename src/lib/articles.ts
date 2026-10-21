import { getCollection } from 'astro:content';

// Published articles, newest first; `order` breaks ties between articles published on the same day.
export async function publishedArticles() {
  const all = await getCollection('articles', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf() || a.data.order - b.data.order);
}
