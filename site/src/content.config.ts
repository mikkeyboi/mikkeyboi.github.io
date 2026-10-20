import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PALETTE } from './core/color';

const HUES = Object.keys(PALETTE) as [keyof typeof PALETTE, ...(keyof typeof PALETTE)[]];

/** One folder per post, posts/NN-slug/index.md(x); the folder name is the URL slug. */
const posts = defineCollection({
  loader: glob({ pattern: '*/index.{md,mdx}', base: './src/content/posts', generateId: ({ entry }) => entry.split('/')[0] }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()),
      image: image(),
      /** Card fields, shared by the CV's writing section and the writing index. */
      short: z.string(),
      tag: z.string(),
      blurb: z.string(),
      hue: z.enum(HUES),
      draft: z.boolean().default(false),
    }),
});

export const collections = { posts };
