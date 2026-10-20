/** What the scenes need from a compute backend. Rust/WebAssembly and TypeScript both implement it. */

export interface SpectrumFit {
  offset: number;
  exponent: number;
  peakHz: number;
  peakHeight: number;
  peakWidth: number;
  r2: number;
}

/** A synthetic intracranial recording plus its Welch spectrum and FOOOF-style fit. */
export interface NeuralKernel {
  /** Latest window of the raw signal, sampled at 1 kHz. */
  readonly signal: Float32Array;
  readonly freqs: Float32Array;
  /** log10 power per frequency bin. */
  readonly power: Float32Array;
  /** Fitted aperiodic component, log10 power per bin. */
  readonly aperiodic: Float32Array;
  fit(): SpectrumFit;
  step(betaGain: number, spikeRate: number): void;
  /** Band-pass the current window to [lo, hi] Hz into slot 0 or 1, with its amplitude envelope. */
  bandPass(slot: 0 | 1, lo: number, hi: number): void;
  band(slot: 0 | 1): Float32Array;
  envelope(slot: 0 | 1): Float32Array;
}

export interface FieldFrame {
  t: number;
  x: number;
  y: number;
  w: number;
  h: number;
  membraneY: number;
  membrane: number;
  cluster: number;
}

/** Falling verbatims that settle into theme clusters. Output stride is 4: x, y, u, flags. */
export interface FieldKernel {
  readonly length: number;
  readonly out: Float32Array;
  setCentre(i: number, x: number, y: number, r: number): void;
  step(frame: FieldFrame, n: number): void;
}

export const FIELD_STRIDE = 4;
export const FLAG_BAD = 1;
export const FLAG_BELOW = 2;

export type Backend = 'rust-wasm' | 'typescript';

export interface Kernels {
  readonly backend: Backend;
  neural(seed: number): NeuralKernel;
  field(n: number): FieldKernel;
}
