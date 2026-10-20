# Site

The Astro project behind minwahleung.ca. Its home page is the living CV, a scroll-driven, canvas-animated CV in TypeScript with Rust compiled to WebAssembly. The writing and the playground share its design system, and posts open from the CV as a quick read. See the repository README for writing a post.

```
npm install
npm run dev      # local preview (Astro dev server)
npm run build    # static site in dist/; SITE_BASE=/sub/path/ builds for a subfolder
npm run check    # astro check (types), lint (ESLint + typescript-eslint) and tests (Vitest)
```

To rebuild the Rust kernels you need a `wasm32-unknown-unknown` target. The build embeds them in `src/kernel/kernel.wasm.ts`, so `npm run build` alone doesn't need Rust:

```
rustup target add wasm32-unknown-unknown
./scripts/build-wasm.sh
cd rust && cargo test
```

## Layout

- `src/pages/` holds the routes. `index.astro` mounts the living CV. `astro.config.mjs` uses `build.format: 'preserve'`, so a page's output path is its source path.
- `src/layouts/Base.astro` and `src/components/` are the shell every page shares. `SiteHeader` is the top bar, `Cover` the generative trace a post carries on its card and under its title, and `post/reader.ts` the reading progress and contents rail.
- `src/styles/tokens.css` holds the design tokens (palette, type, spacing, code colours). `writing.css` is the reading side: posts, cards, the writing index and the playground.
- `src/content/posts/` holds the posts, checked against the schema in `src/content.config.ts`. `lib/rehype-figures.mjs` turns image paragraphs into numbered figures.
- `src/sims/` holds interactive figures. Each is a plain TypeScript class that mounts into a placeholder from `SimFrame.astro`. `mount.ts` loads the widget code only on pages that need it, and `registry.ts` lists what `/playground/` shows.
- `src/quickview/` opens post links on the CV in a sheet over the story. The sheet loads the post's own page, Back closes it, and `?read=<slug>` links straight to it.
- `src/content/` holds the words: one entry per chapter in `chapters.ts` (caption beats and notes pinned to the visual), plus `refs.ts` and `profile.ts`. `posts.ts` reads the post cards the page embeds from the posts collection. Most CV edits start here.
- `src/scenes/` holds one class per chapter visual. Each extends `Scene` and implements `draw(p, t)` for scroll progress `p` (0..1) and time `t`. It calls `mark(id, x, y)` to expose anchors that notes can pin to.
- `src/core/` holds the framework. `Chapter` owns a sticky stage and composes its parts, and `Engine` runs the frame loop, visibility, the chapter rail and analytics. `Painter` is the drawing vocabulary, and the math, colour and site helpers sit beside it.
- `src/core/parts/` holds the stage layers. Each implements `StagePart` and is updated once per frame: `Captions` (beats, progress steps, next hint), `NoteLayer` (notes pinned to the visual), `EraTimeline`, `Legend` and `SpeedControl` (slow by default, faster on hover or click).
- `src/scenes/neuro/task.ts` holds the stop-signal task as pure functions of time, plus `TimeWarp`, which slows neural time and freezes it on a stop signal.
- `tests/` covers content integrity (including every post's slug and hue), both kernel backends against one contract (plus the Rust spectral fit itself), the stop-signal timing, and the refusal simulation's math.
- `rust/` is the compute crate. `neural.rs` synthesizes an intracranial recording (1/f background, bursting beta, spikes), estimates its Welch spectrum with its own FFT, and fits it the way FOOOF does: a robust aperiodic line in log-log space plus the beta peak above it. `field.rs` moves the feedback chapter's particles. `lib.rs` exports both as a plain C ABI over WebAssembly memory.
- `src/kernel/` holds the bridge to that crate. `NeuralKernel` and `FieldKernel` are interfaces with two implementations: the Rust/WebAssembly one, and a TypeScript fallback for places that block WebAssembly. A strict Content-Security-Policy is one example.
- `src/sections/` holds the non-scene parts: the hero chapter (a `Chapter` subclass with its own `StagePart`), the writing cards and the footer.

CI (`.github/workflows/publish.yml` at the repo root) runs `cargo fmt`, `clippy -D warnings` and `cargo test`. It compiles the kernel to WebAssembly and embeds that build, then runs `npm run check`, builds the site, checks that every public URL is still generated, and deploys `dist/` to GitHub Pages.

To add a chapter, write a `Scene` subclass, register it in `src/scenes/index.ts`, and add its content to `chapters.ts`.

Deep links jump to a moment: `#neuro@0.64` opens the neurosurgery chapter 64% of the way through.

Colour carries meaning throughout: copper is research, teal is reliable production.
