import { describe, expect, it } from 'vitest';
import { fitAndRun, simulate } from '../src/sims/refusal/sim.mjs';

// Guards the browser port against drift from the committed Python artifacts: difference-of-means
// recovers the planted axis, ablating the fitted direction suppresses refusal and adding it
// induces refusal, and a norm-matched random control does neither.

describe('planted-model reproduction', () => {
  const r = fitAndRun({ seed: 0 });
  it('recovers the planted axis', () => expect(r.cosine).toBeGreaterThan(0.95));
  it('suppresses with the fitted direction, not the control', () => {
    expect(r.real.baseline_harmful_refusal).toBeGreaterThanOrEqual(0.9);
    expect(r.real.ablation_harmful_refusal).toBeLessThanOrEqual(0.1);
    expect(r.control.ablation_harmful_refusal).toBeGreaterThanOrEqual(0.9);
  });
  it('induces with the fitted direction, not the control', () => {
    expect(r.real.addition_harmless_refusal).toBeGreaterThanOrEqual(0.9);
    expect(r.control.addition_harmless_refusal).toBeLessThanOrEqual(0.1);
  });
  it('reproduces the single-direction verdict', () => expect(r.verdict.verdict).toBe('SINGLE-DIRECTION-REPRODUCES'));
  it('hits the instrument floor when theta clears the harmful cloud', () => {
    expect(fitAndRun({ seed: 0, theta: 6.0 }).verdict.verdict).toBe('NO-BASELINE-REFUSAL');
  });
  it.each([1, 7, 13])('reproduces on seed %i', (seed) => {
    expect(fitAndRun({ seed }).verdict.verdict).toBe('SINGLE-DIRECTION-REPRODUCES');
  });
});

describe('simulate()', () => {
  const sf = simulate({ arm: 'suppress', direction: 'fitted' });
  const sc = simulate({ arm: 'suppress', direction: 'control' });

  it('moves only under the fitted direction', () => {
    expect(sf.rateBefore).toBeGreaterThanOrEqual(0.9);
    expect(sf.rateAfter).toBeLessThanOrEqual(0.1);
    expect(sc.rateAfter).toBeGreaterThanOrEqual(0.9);
    const inf = simulate({ arm: 'induce', direction: 'fitted' });
    expect(inf.rateBefore).toBeLessThanOrEqual(0.1);
    expect(inf.rateAfter).toBeGreaterThanOrEqual(0.9);
    expect(simulate({ arm: 'induce', direction: 'control' }).rateAfter).toBeLessThanOrEqual(0.1);
  });

  it('induces monotonically in dose', () => {
    const doses = [0, 0.5, 1.0, 1.5].map((doseScale) => simulate({ arm: 'induce', direction: 'fitted', doseScale }).rateAfter);
    doses.forEach((v, i) => i && expect(v).toBeGreaterThanOrEqual(doses[i - 1] - 1e-9));
  });

  it('moves the projection cloud across theta (fitted) or leaves it (control)', () => {
    const below = (s: typeof sf) => s.projAfter.filter((p: number) => p <= s.theta).length / s.projAfter.length;
    expect(below(sf)).toBeGreaterThanOrEqual(0.9);
    expect(below(sc)).toBeLessThanOrEqual(0.1);
  });
});

describe('graded worked examples', () => {
  const ind = simulate({ arm: 'induce', direction: 'fitted', doseScale: 1.0 });

  it('carry a prompt and graded tiers', () => {
    expect(ind.examples).toHaveLength(5);
    expect(typeof ind.examples[0].prompt).toBe('string');
    expect(['full', 'hedged', 'refused']).toContain(ind.examples[0].tier_after);
  });

  it('go from full help to refused when the direction is added', () => {
    for (const e of ind.examples) {
      expect(e.tier_before).toBe('full');
      expect(e.tier_after).toBe('refused');
      expect(e.help_after).toBeLessThanOrEqual(e.help_before);
    }
  });

  it('reach every tier across the dose sweep', () => {
    const seen = new Set<string>();
    for (const doseScale of [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0, 1.4]) {
      for (const e of simulate({ arm: 'induce', direction: 'fitted', doseScale }).examples) seen.add(e.tier_after);
    }
    expect([...seen].sort()).toEqual(['full', 'hedged', 'refused']);
  });

  it('restore help under suppression and stay put under the control', () => {
    for (const e of simulate({ arm: 'suppress', direction: 'fitted' }).examples) {
      expect(e.tier_before).toBe('refused');
      expect(e.tier_after).toBe('full');
    }
    for (const e of simulate({ arm: 'induce', direction: 'control', doseScale: 1.0 }).examples) expect(e.tier_after).toBe(e.tier_before);
  });
});
