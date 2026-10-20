import { describe, expect, it } from 'vitest';
import { loadWasmKernels } from '../src/kernel/wasm';
import { tsKernels } from '../src/kernel/fallback';
import type { Kernels } from '../src/kernel/types';

const energy = (v: Float32Array) => v.reduce((a, x) => a + x * x, 0);

/** Both backends must honour the same contract; the Rust one must also get the science right. */
async function backends(): Promise<[string, Kernels][]> {
  return [['rust-wasm', await loadWasmKernels()], ['typescript', tsKernels]];
}

describe('kernel contract', async () => {
  for (const [name, k] of await backends()) {
    it(`${name}: neural outputs have consistent shapes`, () => {
      const n = k.neural(1);
      n.step(1, 10);
      expect(n.freqs.length).toBe(n.power.length);
      expect(n.aperiodic.length).toBe(n.power.length);
      expect(n.signal.length).toBeGreaterThan(1000);
      n.bandPass(0, 13, 30);
      expect(n.band(0).length).toBe(n.signal.length);
      expect(n.envelope(0).length).toBe(n.signal.length);
      expect(Number.isFinite(n.fit().exponent)).toBe(true);
    });

    it(`${name}: field writes four floats per particle`, () => {
      const f = k.field(64);
      for (let i = 0; i < 5; i++) f.setCentre(i, 100 * i, 300, 20);
      f.step({ t: 1, x: 0, y: 0, w: 500, h: 400, membraneY: 150, membrane: 1, cluster: 1 }, 64);
      expect(f.out.length).toBe(64 * 4);
      expect(Array.from(f.out).every(Number.isFinite)).toBe(true);
    });
  }
});

describe('rust neural kernel', async () => {
  const k = await loadWasmKernels();

  it('recovers the aperiodic exponent and a beta peak', () => {
    const n = k.neural(7);
    n.step(1, 0);
    const fit = n.fit();
    expect(fit.exponent).toBeGreaterThan(1.0);
    expect(fit.exponent).toBeLessThan(1.8);
    expect(fit.peakHz).toBeGreaterThanOrEqual(13);
    expect(fit.peakHz).toBeLessThanOrEqual(30);
    expect(fit.r2).toBeGreaterThan(0.8);
  });

  it('stimulation suppresses the peak it measures', () => {
    const a = k.neural(3), b = k.neural(3);
    a.step(1, 0);
    b.step(0.25, 0);
    expect(b.fit().peakHeight).toBeLessThan(a.fit().peakHeight);
  });

  it('the patient band keeps most beta energy with less noise than broad beta', () => {
    const n = k.neural(11);
    n.step(1, 0);
    const { peakHz, peakWidth } = n.fit();
    n.bandPass(0, 13, 30);
    n.bandPass(1, peakHz - peakWidth / 2, peakHz + peakWidth / 2);
    const broad = energy(n.band(0)), narrow = energy(n.band(1));
    expect(narrow).toBeLessThan(broad);
    expect(narrow).toBeGreaterThan(0.35 * broad);
  });
});
