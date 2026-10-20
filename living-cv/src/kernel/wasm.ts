import { KERNEL_WASM } from './kernel.wasm';
import { FIELD_STRIDE, type FieldFrame, type FieldKernel, type Kernels, type NeuralKernel, type SpectrumFit } from './types';

/** Raw exports of rust/src/lib.rs. */
interface Exports {
  memory: WebAssembly.Memory;
  neural_new(seed: number): number;
  neural_step(h: number, beta: number, spikes: number): void;
  neural_len(): number;
  neural_bins(): number;
  neural_signal(h: number): number;
  neural_freqs(h: number): number;
  neural_power(h: number): number;
  neural_aperiodic(h: number): number;
  neural_fit(h: number): number;
  neural_band(h: number, slot: number, lo: number, hi: number): void;
  neural_band_signal(h: number, slot: number): number;
  neural_band_envelope(h: number, slot: number): number;
  field_new(n: number): number;
  field_centre(h: number, i: number, x: number, y: number, r: number): void;
  field_step(h: number, n: number, t: number, x: number, y: number, w: number, hgt: number, my: number, m: number, k: number): void;
  field_out(h: number): number;
}

/**
 * A Float32Array over WebAssembly memory that re-attaches itself if memory grows
 * (growth detaches every existing view).
 */
class MemoryView {
  private view = new Float32Array(0);
  constructor(private readonly mem: WebAssembly.Memory, private readonly ptr: () => number, private readonly len: number) {}
  get(): Float32Array {
    if (this.view.buffer !== this.mem.buffer || this.view.length !== this.len) this.view = new Float32Array(this.mem.buffer, this.ptr(), this.len);
    return this.view;
  }
}

class WasmNeural implements NeuralKernel {
  private readonly h: number;
  private readonly views: Record<'signal' | 'freqs' | 'power' | 'aperiodic' | 'fitv', MemoryView>;
  private readonly bands: MemoryView[];
  private readonly envelopes: MemoryView[];

  constructor(private readonly x: Exports, seed: number) {
    this.h = x.neural_new(seed);
    const bins = x.neural_bins();
    this.views = {
      signal: new MemoryView(x.memory, () => x.neural_signal(this.h), x.neural_len()),
      freqs: new MemoryView(x.memory, () => x.neural_freqs(this.h), bins),
      power: new MemoryView(x.memory, () => x.neural_power(this.h), bins),
      aperiodic: new MemoryView(x.memory, () => x.neural_aperiodic(this.h), bins),
      fitv: new MemoryView(x.memory, () => x.neural_fit(this.h), 6),
    };
    const n = x.neural_len();
    this.bands = [0, 1].map((s) => new MemoryView(x.memory, () => x.neural_band_signal(this.h, s), n));
    this.envelopes = [0, 1].map((s) => new MemoryView(x.memory, () => x.neural_band_envelope(this.h, s), n));
  }

  bandPass(slot: 0 | 1, lo: number, hi: number): void {
    this.x.neural_band(this.h, slot, lo, hi);
  }

  band(slot: 0 | 1): Float32Array { return this.bands[slot].get(); }
  envelope(slot: 0 | 1): Float32Array { return this.envelopes[slot].get(); }

  get signal() { return this.views.signal.get(); }
  get freqs() { return this.views.freqs.get(); }
  get power() { return this.views.power.get(); }
  get aperiodic() { return this.views.aperiodic.get(); }

  fit(): SpectrumFit {
    const f = this.views.fitv.get();
    return { offset: f[0], exponent: f[1], peakHz: f[2], peakHeight: f[3], peakWidth: f[4], r2: f[5] };
  }

  step(betaGain: number, spikeRate: number): void {
    this.x.neural_step(this.h, betaGain, spikeRate);
  }
}

class WasmField implements FieldKernel {
  private readonly h: number;
  private readonly view: MemoryView;

  constructor(private readonly x: Exports, readonly length: number) {
    this.h = x.field_new(length);
    this.view = new MemoryView(x.memory, () => x.field_out(this.h), length * FIELD_STRIDE);
  }

  get out() { return this.view.get(); }

  setCentre(i: number, cx: number, cy: number, r: number): void {
    this.x.field_centre(this.h, i, cx, cy, r);
  }

  step(f: FieldFrame, n: number): void {
    this.x.field_step(this.h, n, f.t, f.x, f.y, f.w, f.h, f.membraneY, f.membrane, f.cluster);
  }
}

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Instantiate the Rust kernels. Throws where WebAssembly is unavailable or blocked by policy. */
export async function loadWasmKernels(): Promise<Kernels> {
  const { instance } = await WebAssembly.instantiate(decode(KERNEL_WASM), {});
  const x = instance.exports as unknown as Exports;
  return {
    backend: 'rust-wasm',
    neural: (seed) => new WasmNeural(x, seed),
    field: (n) => new WasmField(x, n),
  };
}
