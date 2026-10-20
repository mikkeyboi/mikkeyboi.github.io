import { clamp, ease, frac, hash, lerp } from '../../core/math';

/*
 * The countermanding (stop-signal) task and the neural time it runs on. Pure functions of time,
 * so the eye trace, the stop markers, the beta bursts and the epochs all agree.
 */

/** Countermanding trial length and the moments within it (fractions of a trial). */
export const TRIAL = 1.8, TARGET_ON = 0.3, STOP_ON = 0.38, SACCADE = 0.45;
/** Which trials carry a stop signal: about half, never more than two go trials in a row. */
const STOP_PATTERN = [false, true, false, true, true, false, false, true];
/** Neural time runs slower than wall time so a first-time viewer can follow it. */
export const SIM_RATE = 0.35;
/** Scroll range in the stop beat where time freezes on a stop signal, with annotations. */
export const PAUSE_FROM = 0.385, PAUSE_TO = 0.455;
/** How far past the stop signal (seconds) time freezes, so the burst after it is in view. */
const HOLD_AT = 0.95;
export const isStop = (k: number) => STOP_PATTERN[((k % STOP_PATTERN.length) + STOP_PATTERN.length) % STOP_PATTERN.length];

export interface Trial { k: number; f: number; stop: boolean; target: number }

/** The countermanding task at scene time t: fixate, look to the target, unless told to stop. */
export function trialAt(t: number): Trial {
  const k = Math.floor(t / TRIAL);
  return { k, f: frac(t / TRIAL), stop: isStop(k), target: hash(k * 2.3) * 2 - 1 };
}

/** Horizontal gaze (-1..1) at time t, as the eye tracker would record it. */
export function gazeAt(t: number): number {
  const tr = trialAt(t);
  if (tr.stop || tr.f < SACCADE) return 0;
  return tr.target * ease(clamp((tr.f - SACCADE) / 0.05));
}

/** The most recent stop-signal time at or before t, if any in the last few trials. */
export function lastStopBefore(t: number): number | null {
  for (let k = Math.floor(t / TRIAL); k > Math.floor(t / TRIAL) - 10; k--) {
    const st = (k + STOP_ON) * TRIAL;
    if (isStop(k) && st <= t) return st;
  }
  return null;
}

/** Beta burst strength at time t: stop signals provoke a burst shortly after they appear. */
export function burstAt(t: number): number {
  const tr = trialAt(t);
  if (!tr.stop) return 0;
  const since = (tr.f - STOP_ON) * TRIAL;
  return since < -0.05 ? 0 : Math.exp(-(((since - 0.22) / 0.12) ** 2));
}

/**
 * Scene time for the neural chapter: slower than wall time, and frozen on a stop signal while
 * the reader is inside the pause zone, so the stop and the burst after it can be studied.
 */
export class TimeWarp {
  t = 0;
  /** The stop signal time is frozen on, while paused. */
  hold: number | null = null;
  private lastWall = -1;
  private rate = SIM_RATE;

  /** How fully time is stopped, 0..1 (drives the annotations' fade). */
  get frozen(): number {
    return 1 - this.rate / SIM_RATE;
  }

  advance(p: number, wall: number): number {
    const dt = this.lastWall < 0 ? 0 : clamp(wall - this.lastWall, 0, 0.1);
    this.lastWall = wall;
    let target = SIM_RATE;
    if (p >= PAUSE_FROM && p < PAUSE_TO) {
      const st = lastStopBefore(this.t);
      if (st !== null && this.t - st >= HOLD_AT) { target = 0; this.hold = st; }
    } else this.hold = null;
    this.rate = lerp(this.rate, target, target === 0 ? 0.2 : 0.05);
    this.t += dt * this.rate;
    return this.t;
  }
}
