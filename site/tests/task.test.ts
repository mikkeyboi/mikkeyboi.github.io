import { describe, expect, it } from 'vitest';
import { PAUSE_FROM, SIM_RATE, STOP_ON, TRIAL, TimeWarp, burstAt, gazeAt, isStop, trialAt } from '../src/scenes/neuro/task';

const firstStop = () => { let k = 0; while (!isStop(k)) k++; return k; };

describe('stop-signal task', () => {
  it('holds gaze at fixation on stop trials', () => {
    const k = firstStop();
    for (let f = 0; f < 1; f += 0.05) expect(gazeAt((k + f) * TRIAL)).toBe(0);
  });

  it('provokes a beta burst about 220 ms after the stop signal', () => {
    const st = (firstStop() + STOP_ON) * TRIAL;
    expect(burstAt(st + 0.22)).toBeCloseTo(1, 2);
    expect(burstAt(st - 0.2)).toBe(0);
  });

  it('never leaves more than two go trials in a row', () => {
    let run = 0;
    for (let k = 0; k < 64; k++) { run = trialAt(k * TRIAL + 0.01).stop ? 0 : run + 1; expect(run).toBeLessThanOrEqual(2); }
  });
});

describe('time warp', () => {
  it('runs slower than wall time outside the pause zone', () => {
    const w = new TimeWarp();
    for (let i = 0; i <= 60; i++) w.advance(0.1, i / 60);
    expect(w.t).toBeCloseTo(SIM_RATE, 1);
  });

  it('freezes on a stop signal inside the pause zone', () => {
    const w = new TimeWarp();
    for (let i = 0; i <= 60 * 40; i++) w.advance(PAUSE_FROM + 0.01, i / 60);
    const t = w.t;
    for (let i = 1; i <= 60; i++) w.advance(PAUSE_FROM + 0.01, 40 + i / 60);
    expect(w.hold).not.toBeNull();
    expect(w.t - t).toBeLessThan(0.01);
    expect(w.frozen).toBeGreaterThan(0.95);
  });
});
