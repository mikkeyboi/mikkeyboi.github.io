import { TAU, ease, frac, hash, vnoise } from '../core/math';
import { FIELD_STRIDE, FLAG_BAD, FLAG_BELOW, type FieldFrame, type FieldKernel, type Kernels, type NeuralKernel, type SpectrumFit } from './types';

const BINS = 513, FS = 1000, N = 8192, EXPONENT = 1.4;

/**
 * TypeScript stand-in for the Rust neural kernel: the same outputs, drawn from the model
 * directly instead of estimated from a synthesized recording.
 */
class TsNeural implements NeuralKernel {
  readonly signal = new Float32Array(N);
  readonly freqs = Float32Array.from({ length: BINS }, (_, k) => (k * FS) / 1024);
  readonly power = new Float32Array(BINS);
  readonly aperiodic = new Float32Array(BINS);
  private peak = 0;
  private clock = 0;
  private gain = 1;
  private readonly bands = [new Float32Array(N), new Float32Array(N)];
  private readonly envelopes = [new Float32Array(N), new Float32Array(N)];

  constructor(private readonly seed: number) {}

  fit(): SpectrumFit {
    return { offset: 0, exponent: EXPONENT, peakHz: 19, peakHeight: this.peak, peakWidth: 8, r2: 0.98 };
  }

  /** Approximation: the narrow band is the beta rhythm itself; the broad band adds in-band noise. */
  bandPass(slot: 0 | 1, lo: number, hi: number): void {
    const c = this.clock + this.seed * 31, width = hi - lo;
    for (let i = 0; i < N; i++) {
      const t = i / FS, env = this.gain * 0.9 * (0.55 + 0.45 * Math.sin(TAU * 0.9 * t + c));
      const noise = vnoise(i * 0.08 * width + c * 7) * 0.35 * Math.sqrt(width / 5);
      this.bands[slot][i] = env * Math.sin(TAU * 19 * t + c) + noise;
      this.envelopes[slot][i] = Math.abs(env + noise * 0.8);
    }
  }

  band(slot: 0 | 1): Float32Array { return this.bands[slot]; }
  envelope(slot: 0 | 1): Float32Array { return this.envelopes[slot]; }

  step(betaGain: number, spikeRate: number): void {
    this.clock += 1;
    this.gain = betaGain;
    const c = this.clock + this.seed * 31;
    for (let i = 0; i < N; i++) {
      const t = i / FS;
      let v = vnoise(i * 0.35 + c * 97) * 0.8 + vnoise(i * 0.05 + c * 13) * 0.6 + betaGain * 0.9 * Math.sin(TAU * 19 * t + c);
      if (hash(i * 1.3 + c) < spikeRate / FS) v -= 3;
      this.signal[i] = v;
    }
    this.peak = 0.75 * betaGain;
    for (let k = 0; k < BINS; k++) {
      const f = Math.max(this.freqs[k], 1);
      this.aperiodic[k] = -0.5 - EXPONENT * Math.log10(f);
      this.power[k] = this.aperiodic[k] + this.peak * Math.exp(-(((f - 19) / 4.2) ** 2)) + 0.12 * Math.exp(-(((f - 9) / 1.6) ** 2)) + vnoise(f * 0.7 + c) * 0.05;
    }
  }
}

const WEIGHTS = [0.24, 0.18, 0.28, 0.13, 0.17];

/** Port of rust/src/field.rs. */
class TsField implements FieldKernel {
  readonly out: Float32Array;
  private readonly centres = Array.from({ length: 5 }, () => ({ x: 0, y: 0, r: 0 }));
  private readonly parts: { x: number; sp: number; ph: number; bad: boolean; cl: number; a0: number; rr: number; settle: number }[];

  constructor(readonly length: number) {
    this.out = new Float32Array(length * FIELD_STRIDE);
    this.parts = Array.from({ length }, (_, i) => {
      let r = hash(i * 1.91), cl = 0;
      while (cl < 4 && r > WEIGHTS[cl]) { r -= WEIGHTS[cl]; cl++; }
      return { x: hash(i), sp: 0.08 + hash(i + 0.5) * 0.14, ph: hash(i * 2.7), bad: hash(i * 4.3) < 0.14, cl, a0: hash(i * 6.1) * TAU, rr: Math.sqrt(hash(i * 7.7)), settle: hash(i * 8.9) };
    });
  }

  setCentre(i: number, x: number, y: number, r: number): void {
    this.centres[i] = { x, y, r };
  }

  step(f: FieldFrame, n: number): void {
    const count = Math.min(n, this.length);
    for (let i = 0; i < count; i++) {
      const v = this.parts[i];
      const s = frac(v.ph + f.t * v.sp * 0.5);
      let x = f.x + v.x * f.w + Math.sin(f.t * 0.8 + v.ph * 20) * 4, y = f.y + 40 + s * (f.h - 30);
      const below = f.membrane > 0.05 && y > f.membraneY;
      let u = 0;
      if (below && f.cluster > 0) {
        const c = this.centres[v.cl];
        const ang = v.a0 + f.t * 0.22 * (1 + v.rr);
        const ox = c.x + Math.cos(ang) * v.rr * c.r, oy = c.y + Math.sin(ang) * v.rr * c.r * 0.8;
        u = v.settle < f.cluster * 0.75 ? 1 : f.cluster * ease(Math.min(1, Math.max(0, (y - f.membraneY) / (f.h * 0.3))));
        x += (ox - x) * u;
        y += (oy - y) * u;
      }
      const o = i * FIELD_STRIDE;
      this.out[o] = x; this.out[o + 1] = y; this.out[o + 2] = u;
      this.out[o + 3] = (v.bad ? FLAG_BAD : 0) | (below ? FLAG_BELOW : 0) | (v.cl << 2);
    }
  }
}

export const tsKernels: Kernels = {
  backend: 'typescript',
  neural: (seed) => new TsNeural(seed),
  field: (n) => new TsField(n),
};
