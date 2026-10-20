# Site

The Astro project behind mikkeyboi.github.io. Its home page is the living CV: a scroll-driven, canvas-animated CV in TypeScript with Rust compiled to WebAssembly. The writing (posts, playground, listing) is moving here from Quarto so every page shares one design system.

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
- `src/layouts/Base.astro` and `src/components/SiteHeader.astro` are the shell every page shares.
- `src/styles/tokens.css` holds the design tokens (palette, type, spacing) that every page uses.
- `src/content/` holds the words: one entry per chapter in `chapters.ts` (caption beats and notes pinned to the visual), plus `refs.ts`, `posts.ts` and `profile.ts`. Most edits start here.
- `src/scenes/` holds one class per chapter visual. Each extends `Scene` and implements `draw(p, t)` for scroll progress `p` (0..1) and time `t`. It calls `mark(id, x, y)` to expose anchors that notes can pin to.
- `src/core/` holds the framework. `Chapter` owns a sticky stage and composes its parts, and `Engine` runs the frame loop, visibility, the chapter rail and analytics. `Painter` is the drawing vocabulary, and the math, colour and site helpers sit beside it.
- `src/core/parts/` holds the stage layers. Each implements `StagePart` and is updated once per frame: `Captions` (beats, progress steps, next hint), `NoteLayer` (notes pinned to the visual), `EraTimeline`, `Legend` and `SpeedControl` (slow by default, faster on hover or click).
- `src/scenes/neuro/task.ts` holds the stop-signal task as pure functions of time, plus `TimeWarp`, which slows neural time and freezes it on a stop signal.
- `tests/` covers content integrity, both kernel backends against one contract (plus the Rust spectral fit itself), and the stop-signal timing.
- `rust/` is the compute crate. `neural.rs` synthesizes an intracranial recording (1/f background, bursting beta, spikes), estimates its Welch spectrum with its own FFT, and fits it the way FOOOF does: a robust aperiodic line in log-log space plus the beta peak above it. `field.rs` moves the feedback chapter's particles. `lib.rs` exports both as a plain C ABI over WebAssembly memory.
- `src/kernel/` holds the bridge to that crate. `NeuralKernel` and `FieldKernel` are interfaces with two implementations: the Rust/WebAssembly one, and a TypeScript fallback for places that block WebAssembly. A strict Content-Security-Policy is one example.
- `src/sections/` holds the non-scene parts: the hero chapter (a `Chapter` subclass with its own `StagePart`), the writing cards and the footer.

CI (`.github/workflows/publish.yml` at the repo root) runs `cargo fmt`, `clippy -D warnings` and `cargo test`. It compiles the kernel to WebAssembly and embeds that build, then runs `npm run check` and builds the site.

To add a chapter, write a `Scene` subclass, register it in `src/scenes/index.ts`, and add its content to `chapters.ts`.

Deep links jump to a moment: `#neuro@0.64` opens the neurosurgery chapter 64% of the way through.

Colour carries meaning throughout: copper is research, teal is reliable production.
