# mikkeyboi.github.io — Quarto site source

Personal site + blog. Built with [Quarto](https://quarto.org), deployed to GitHub Pages via Actions on every push to `main`.

## Layout

```
.
├── site/                   Astro site; home page is the living CV (TypeScript, Rust → WebAssembly)
├── _quarto.yml             Site config (theme, navbar, render list)
├── writing.qmd             Writing index = posts listing (/writing.html)
├── about.qmd               About page
├── playground/             Interactive simulations (OJS widgets)
├── posts/NN-slug/          One post per folder; URLs stay /posts/NN-slug/
├── fonts/                  Ubuntu, for the Quarto theme (the Astro site bundles its own copy)
├── styles.css, theme*.scss Quarto styling (dark first, matching the living CV)
└── .github/workflows/publish.yml   Builds the Astro site, renders Quarto, merges both, deploys
```

The published site is one folder: Quarto renders posts, the playground and the writing index into
`_site/`, then the workflow copies the Astro build (`site/dist/`) over it, so `/` is the living CV and
everything else keeps its URL. Pull requests run the same build without deploying.

The writing is moving from Quarto into the Astro site so the CV and the posts share one design system
and one navigation shell. Until that lands, both builds run side by side.

## Local preview

```bash
# Install Quarto first: https://quarto.org/docs/get-started/
quarto preview              # live-reload at http://localhost:4444 (posts, playground, writing)
(cd site && npm ci && npm run dev)        # the Astro site (living CV) on its own

# The whole site, as published:
(cd site && npm ci && npm run build) && quarto render && cp -R site/dist/. _site/
```

## Publishing

When this folder is pushed to `mikkeyboi/mikkeyboi.github.io` (the `main` branch), the Actions workflow builds the Astro site, renders Quarto, and publishes to GitHub Pages automatically. Site URL: <https://minwahleung.ca> (also served at <https://mikkeyboi.github.io>, which redirects).

**One-time setup on the GitHub repo:**

1. Create the repo `mikkeyboi/mikkeyboi.github.io` (must match the username for a *user* site).
2. Settings → Pages → Source = **GitHub Actions** (not the legacy "Deploy from a branch").
3. Push this folder's contents to `main`. The workflow will run and the site will appear at <https://mikkeyboi.github.io> in a couple of minutes.

## Conventions

- **Drafts stay drafts.** Each post starts with `draft: true` in the YAML front-matter so it doesn't appear on the listing until you flip it to `false`.
- **Plans live in `anthropic-prep/blog-plans/`**, not here. This folder is for the rendered site only.
- **No proprietary content.** Sanitization happens *before* a draft moves into a `posts/NN-slug/index.qmd`. See sanitization checklists in each plan.
- **One post per folder** (`posts/NN-slug/index.qmd` + any `figures/` subfolder). Numeric prefixes are stable; titles can change.

## Adding a new post

1. `mkdir posts/NN-slug && touch posts/NN-slug/index.qmd`
2. Front-matter:
   ```yaml
   ---
   title: "..."
   description: "..."
   author: "Mike Leung"
   date: "YYYY-MM-DD"
   categories: [tag1, tag2]
   draft: true
   ---
   ```
3. Preview locally with `quarto preview`. Push when ready.
