# Living CV

A scroll-driven, canvas-animated CV. Vite + TypeScript with Rust compiled to WebAssembly, and no runtime dependencies.

```
npm install
npm run dev      # local preview
npm run build    # static site in dist/ (relative paths; host it anywhere)
```

To rebuild the Rust kernels you need a `wasm32-unknown-unknown` target. The build embeds them in `src/kernel/kernel.wasm.ts`, so `npm run build` alone doesn't need Rust:

```
rustup target add wasm32-unknown-unknown
./scripts/build-wasm.sh
cd rust && cargo test
```

## Layout

- `src/content/` holds the words: one entry per chapter in `chapters.ts` (caption beats and notes pinned to the visual), plus `refs.ts`, `posts.ts` and `profile.ts`. Most edits start here.
- `src/scenes/` holds one class per chapter visual. Each extends `Scene` and implements `draw(p, t)` for scroll progress `p` (0..1) and time `t`. It calls `mark(id, x, y)` to expose anchors that notes can pin to.
- `src/core/` holds the framework: `Chapter` (a sticky stage, captions, notes and next hints), `Engine` (the frame loop, visibility and chapter rail), `Painter` (drawing vocabulary), and the math and colour helpers.
- `rust/` is the compute crate. `neural.rs` synthesizes an intracranial recording (1/f background, bursting beta, spikes), estimates its Welch spectrum with its own FFT, and fits it the way FOOOF does: a robust aperiodic line in log-log space plus the beta peak above it. `field.rs` moves the feedback chapter's particles. `lib.rs` exports both as a plain C ABI over WebAssembly memory.
- `src/kernel/` holds the bridge to that crate. `NeuralKernel` and `FieldKernel` are interfaces with two implementations: the Rust/WebAssembly one, and a TypeScript fallback for places that block WebAssembly. A strict Content-Security-Policy is one example.
- `src/sections/` holds the non-scene parts: the hero chapter (a `Chapter` subclass), the writing cards and the footer.

To add a chapter, write a `Scene` subclass, register it in `src/scenes/index.ts`, and add its content to `chapters.ts`.

Deep links jump to a moment: `#neuro@0.64` opens the neurosurgery chapter 64% of the way through.

Colour carries meaning throughout: copper is research, teal is reliable production.
