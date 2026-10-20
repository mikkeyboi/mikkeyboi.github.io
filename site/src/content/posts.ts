import type { Post } from './types';

/**
 * Blog posts, newest first. The posts collection (src/content/posts/) is the source; the page
 * embeds the card fields as JSON in #posts-data so the CV's client code reads the same list.
 */
export function readPosts(doc: Document = document): Post[] {
  const data = doc.getElementById('posts-data')?.textContent;
  return data ? (JSON.parse(data) as Post[]) : [];
}
