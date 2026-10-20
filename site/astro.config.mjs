import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeFigures from './src/lib/rehype-figures.mjs';

// One static site for GitHub Pages. 'preserve' keeps output paths as the source names them:
// writing.astro -> /writing.html, posts/[slug]/index.astro -> /posts/<slug>/index.html.
// SITE_BASE serves the build from a subfolder, such as the private preview under /static/cv/.
export default defineConfig({
  site: 'https://minwahleung.ca',
  base: process.env.SITE_BASE ?? '/',
  output: 'static',
  outDir: 'dist',
  trailingSlash: 'ignore',
  build: { format: 'preserve' },
  integrations: [mdx()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex, rehypeFigures] }),
    // Colours come from tokens.css, so code follows the site's palette.
    shikiConfig: { theme: 'css-variables' },
  },
});
