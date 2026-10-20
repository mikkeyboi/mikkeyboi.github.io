import { getCollection, type CollectionEntry } from 'astro:content';
import type { Post } from '../content/types';

export type PostEntry = CollectionEntry<'posts'>;

/** Published posts, newest first. */
export async function getPosts(): Promise<PostEntry[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** The card fields the CV's client code reads (see content/posts.ts). */
export const toCard = (p: PostEntry): Post => ({ slug: p.id, tag: p.data.tag, title: p.data.short, blurb: p.data.blurb, hue: p.data.hue });

/** Minutes to read at 230 words a minute, counting prose only. */
export function readingMinutes(p: PostEntry): number {
  const text = (p.body ?? '').replace(/^import .*$/gm, '').replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 230));
}

export const formatDate = (d: Date): string => d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
