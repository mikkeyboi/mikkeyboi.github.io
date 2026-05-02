# mikkeyboi.github.io — Quarto site source

Personal site + blog. Built with [Quarto](https://quarto.org), deployed to GitHub Pages via Actions on every push to `main`.

## Layout

```
.
├── _quarto.yml             Site config (theme, navbar, listing)
├── index.qmd               Homepage = posts listing
├── about.qmd               About page
├── styles.css              Light CSS overrides on top of cosmo
├── theme.scss              SCSS variable tweaks
├── posts/
│   ├── 01-sft-grpo-hvac/index.qmd       Post #1 (draft)
│   ├── 02-bci-spatial-filters/index.qmd Post #2 (draft)
│   └── 03-cslt-seq2seq/index.qmd        Post #3 (draft)
└── .github/workflows/publish.yml        GH Pages deploy
```

## Local preview

```bash
# Install Quarto first: https://quarto.org/docs/get-started/
quarto preview              # live-reload at http://localhost:4444
quarto render               # one-shot render to ./_site
```

## Publishing

When this folder is pushed to `mikkeyboi/mikkeyboi.github.io` (the `main` branch), the Actions workflow renders Quarto and publishes to GitHub Pages automatically. Site URL: <https://mikkeyboi.github.io>.

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
