# minwahleung.ca

My personal site: a living CV, the writing behind it, and a playground of interactive simulations.
It's one Astro project in [`site/`](site/), deployed to GitHub Pages by Actions on every push to `main`.
It's served at <https://minwahleung.ca>; <https://mikkeyboi.github.io> redirects there.

```
site/
├── src/pages/            Routes: / (living CV), /writing.html, /posts/<slug>/, /playground/
├── src/content/posts/    One folder per post: index.md(x) plus its figures and data
├── src/layouts/, components/, styles/   The shared shell and design system
├── src/sims/             Interactive figures, mounted as islands in posts and on the playground
├── src/quickview/        Opens posts from the CV as a quick read
├── src/scenes/, core/    The living CV's scroll-driven scenes and engine
└── rust/                 Compute kernels, compiled to WebAssembly
```

## Local preview

```bash
cd site
npm ci
npm run dev       # live preview
npm run check     # astro check, ESLint, Vitest
npm run build && npm run verify   # the site as published, plus the public-URL check
```

## Writing a post

1. Create `site/src/content/posts/NN-slug/index.md`. The folder name is the URL, `/posts/NN-slug/`, and it never changes.
2. Fill in the front matter. `src/content.config.ts` checks it at build time.
   ```yaml
   ---
   title: "..."
   description: "..."            # the dek under the title, and the social card text
   date: 2026-10-20
   tags: [interpretability, steering]
   image: ./images/hero.png      # social card
   short: "..."                  # card title on the CV
   tag: Interpretability         # card kicker
   blurb: "..."                  # card line on the CV
   hue: teal                     # the post's accent: copper, teal, red, violet, sky, mint or amber
   draft: true
   ---
   ```
3. Write in Markdown. A paragraph holding only an image becomes a numbered figure, with the alt text as its caption. `$...$` and `$$...$$` render as maths.
4. For an interactive figure, name the file `index.mdx` and import a component from `src/sims/`, as post 05 does with `<RefusalToy />`.
5. Set `draft: false` to publish. The post then appears on the CV, in Writing, and in the quick view.

## Conventions

- **No proprietary content.** Sanitize before a draft becomes a post.
- **Public URLs are permanent.** `npm run verify` fails the build if a post, `/writing.html`, `/playground/` or `/about.html` stops being generated.
