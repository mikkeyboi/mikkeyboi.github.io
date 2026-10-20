import { Scene } from '../../core/scene';
import { TAU, clamp, ease, frac, hash, lerp, seg, type Box, type Point } from '../../core/math';
import { css, type Hue } from '../../core/color';
import { kernels, type NeuralKernel } from '../../kernel';
import { STOP_ON, TARGET_ON, SACCADE, TRIAL, TimeWarp, burstAt, gazeAt, isStop, trialAt } from './task';

/** Head profile facing right, in head-radius units. */
const HEAD: [number, number][] = [[-0.42, 1.15], [-0.62, 0.75], [-0.98, 0.25], [-1.0, -0.3], [-0.72, -0.82], [-0.1, -1.08], [0.5, -0.92], [0.86, -0.5], [0.92, -0.2],
  [1.12, 0.12], [0.97, 0.28], [1.02, 0.4], [0.96, 0.52], [0.99, 0.62], [0.88, 0.78], [0.6, 0.86], [0.48, 1.15]];

/** Sensor streams; each lane's clock drifts until the common clock locks them (periods in seconds). */
const STREAMS: { name: string; hue: Hue; period: number; offset: number }[] = [
  { name: 'INTRACRANIAL · 30 kHz', hue: 'copper', period: 0.27, offset: 0.06 },
  { name: 'EYE · 120 Hz', hue: 'violet', period: 0.225, offset: 0.1 },
  { name: 'VR HEADSET · 1 kHz', hue: 'sky', period: 0.295, offset: 0.025 },
];
const COMMON_PERIOD = 0.25;
/** Seconds of signal visible across a lane; the newest sample is at the right edge. */
const LANE_SECONDS = 2.5;
const FS = 1000;
/** A fresh recording window is synthesized and fit this often (seconds of scene time). */
const STEP_EVERY = 5;
const STIM = [
  { name: 'AMPLITUDE', from: 0.25, to: 0.58, value: '2.5 mA' },
  { name: 'FREQUENCY', from: 0.4, to: 0.72, value: '130 Hz' },
  { name: 'PULSE WIDTH', from: 0.6, to: 0.38, value: '60 µs' },
];

/**
 * Awake deep brain stimulation surgery: the electrode descends, three sensor clocks align,
 * a stop-signal task provokes beta bursts, the patient's own beta band is profiled, and
 * stimulation flattens it. The clinical core stays intact.
 */
export class NeuroScene extends Scene {
  private R = 0;
  private hx = 0;
  private hy = 0;
  private panel: Box = { x: 0, y: 0, w: 0, h: 0 };
  private inset: Box = { x: 0, y: 0, w: 0, h: 0 };

  /** Live recording, spectrum and fit, computed by the Rust kernel when available. */
  private readonly neural: NeuralKernel = kernels().neural(17);
  private lastStep = -Infinity;
  private lastGain = -1;
  private shownPower = new Float32Array(0);
  private shownAperiodic = new Float32Array(0);
  private range: [number, number] | null = null;
  /** Patient-specific beta band from the fit, smoothed for display. */
  private band: [number, number] = [17, 22];

  protected layout(): void {
    const V = this.box;
    if (!this.narrow) {
      this.R = Math.min(V.w * 0.14, V.h * 0.24);
      this.hx = V.x + V.w * 0.2;
      this.hy = V.y + V.h * 0.58;
      this.panel = { x: V.x + V.w * 0.47, y: V.y + V.h * 0.2, w: V.w * 0.5, h: V.h * 0.62 };
      this.inset = { x: this.hx + this.R * 0.35, y: this.hy - this.R * 2.1, w: this.R * 1.5, h: this.R * 0.82 };
    } else {
      this.R = Math.min(V.w * 0.19, V.h * 0.19);
      this.hx = V.x + V.w * 0.34;
      this.hy = V.y + V.h * 0.33;
      this.panel = { x: V.x + 16, y: V.y + V.h * 0.66, w: V.w - 32, h: V.h * 0.34 };
      const ix = this.hx + this.R * 1.3;
      this.inset = { x: ix, y: this.hy - this.R * 0.95, w: Math.min(this.R * 1.3, V.w - ix - 12), h: this.R * 0.8 };
    }
  }

  private H(x: number, y: number): Point {
    return { x: this.hx + x * this.R, y: this.hy + y * this.R };
  }

  /** Re-synthesize and re-fit when time has moved on or stimulation changed the rhythm. */
  private refresh(t: number, gain: number, spikes: number): void {
    if (t - this.lastStep < STEP_EVERY && Math.abs(gain - this.lastGain) < 0.04) return;
    const n = this.neural;
    n.step(gain, spikes);
    this.lastStep = t;
    this.lastGain = gain;
    const fit = n.fit();
    // The patient band is profiled before stimulation and then held fixed.
    if (gain > 0.8 || this.shownPower.length === 0) this.band = [Math.max(13, fit.peakHz - fit.peakWidth / 2), Math.min(30, fit.peakHz + fit.peakWidth / 2)];
    n.bandPass(0, 13, 30);
    n.bandPass(1, this.band[0], this.band[1]);
    if (this.shownPower.length !== n.power.length) {
      this.shownPower = Float32Array.from(n.power);
      this.shownAperiodic = Float32Array.from(n.aperiodic);
    }
    if (!this.range) {
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < n.freqs.length; k++) {
        if (n.freqs[k] < 2 || n.freqs[k] > 100) continue;
        lo = Math.min(lo, n.power[k], n.aperiodic[k]);
        hi = Math.max(hi, n.power[k]);
      }
      this.range = [lo - 0.15, hi + 0.25];
    }
  }

  /** Sample index in the current window for scene time tt (newest data is "now"). */
  private sampleAt(tt: number): number {
    const len = this.neural.signal.length;
    return clamp(Math.floor(len - 1 - (this.lastStep + STEP_EVERY - tt) * FS), 0, len - 1);
  }

  /** Neural time: slowed, and frozen on a stop signal while the reader is in the pause zone. */
  private readonly time = new TimeWarp();

  draw(p: number, wall: number): void {
    const t = this.time.advance(p, wall);
    const e = ease(seg(p, 0.02, 0.24));
    const lanes = ease(seg(p, 0.12, 0.2));
    const sync = ease(seg(p, 0.24, 0.34));
    const stop = ease(seg(p, 0.35, 0.41)) * (1 - ease(seg(p, 0.47, 0.5)));
    const spec = ease(seg(p, 0.48, 0.54));
    const cmp = ease(seg(p, 0.6, 0.66)) * (1 - ease(seg(p, 0.72, 0.75)));
    const stim = ease(seg(p, 0.74, 0.84));
    const shield = ease(seg(p, 0.86, 0.95));
    if (lanes > 0 || spec > 0) this.refresh(t, lerp(1, 0.25, stim), 8 + 30 * e);

    this.drawBrain(p, t);
    const tip = this.drawElectrode(p, t, e, stim);
    this.drawShield(t, shield);
    this.drawEyeInset(p, t, stop);
    this.drawTap(t, lanes);
    this.drawStreams(t, lanes * (1 - spec), sync, stop);
    if (spec > 0.01) this.drawSpectrum(p, t, spec, stim, cmp);
    this.mark('tip', tip.x, tip.y);
  }

  private drawBrain(p: number, t: number): void {
    const P = this.paint, { R, hx, hy } = this;
    for (let k = 0; k < 5; k++) {
      const sc = 1 - k * 0.18, pts: Point[] = [];
      for (let j = 0; j < 40; j++) {
        const th = (j / 40) * TAU, rr = 1 + 0.05 * Math.sin(7 * th + k) + 0.03 * Math.sin(13 * th + 1 + k);
        pts.push(this.H(-0.1 + Math.cos(th) * 0.72 * sc * rr, -0.3 + Math.sin(th) * 0.55 * sc * rr));
      }
      this.ctx.beginPath(); P.smooth(pts, true);
      this.ctx.strokeStyle = css('grey', 0.1 + k * 0.03); this.ctx.stroke();
    }
    const scan = seg(p, 0, 0.12);
    if (scan > 0 && scan < 1) {
      const sy = hy + lerp(-1.05, 0.3, frac(t * 0.25)) * R;
      P.line(hx - R, sy, hx + R * 0.9, sy, 'teal', 0.35 * Math.sin(scan * Math.PI));
    }
    this.ctx.beginPath(); P.smooth(HEAD.map(([x, y]) => this.H(x, y)));
    this.ctx.strokeStyle = css('teal', 0.75); this.ctx.lineWidth = 1.6; this.ctx.stroke(); this.ctx.lineWidth = 1;

    const vr = ease(seg(p, 0.05, 0.13));
    if (vr > 0) {
      const c = this.ctx, v = this.H(0.74, -0.14);
      c.save(); c.translate(v.x, v.y); c.rotate(-0.08);
      P.roundRect(-0.32 * R, -0.2 * R, 0.62 * R, 0.4 * R, 0.08 * R);
      c.fillStyle = css('ink', 0.9 * vr); c.fill();
      c.strokeStyle = css('copper', 0.9 * vr); c.lineWidth = 1.6; c.stroke();
      c.fillStyle = css('copper', 0.5 * vr); c.fillRect(0.12 * R, -0.04 * R, 0.1 * R, 0.08 * R);
      c.restore();
      c.beginPath(); P.smooth([this.H(0.45, -0.28), this.H(-0.2, -0.5), this.H(-0.8, -0.35), this.H(-0.98, -0.1)]);
      c.strokeStyle = css('copper', 0.55 * vr); c.lineWidth = 2; c.stroke(); c.lineWidth = 1;
      this.mark('headset', v.x + 0.3 * R, v.y);
    }
  }

  private drawElectrode(p: number, t: number, e: number, stim: number): Point {
    const P = this.paint, R = this.R;
    const T = this.H(0.08, 0.02), E = this.H(-0.35, -0.98);
    const S = { x: E.x + (E.x - T.x) * 0.55, y: E.y + (E.y - T.y) * 0.55 };
    P.line(E.x, E.y, T.x, T.y, 'teal', 0.45, 1, [4, 5]);
    if (p < 0.18) P.text('PLANNED TRAJECTORY · MRI/CT', E.x - 8, E.y - 26, 'teal', 0.7 * (1 - seg(p, 0.12, 0.18)), 10, 'right');
    this.mark('trajectory', lerp(E.x, T.x, 0.3), lerp(E.y, T.y, 0.3));
    const tip = { x: lerp(S.x, T.x, e), y: lerp(S.y, T.y, e) };
    P.line(S.x, S.y, tip.x, tip.y, 'white', 0.85, 1.4);
    P.glow(tip.x, tip.y, 10 + 8 * e, 'teal', 0.6);
    P.dot(T.x, T.y, 3, 'copper', 0.25 + 0.5 * e);
    if (p < 0.27) P.text(`${lerp(25, 0, e).toFixed(1)} mm`, tip.x + 12, tip.y - 2, 'white', 0.8 * (1 - seg(p, 0.23, 0.27)), 11);
    if (e > 0.5) {
      const tick = Math.floor(t * 12);
      for (let j = 0; j < 14; j++) {
        if (hash(tick * 31 + j) < 0.55) continue;
        const a = hash(j * 9.1) * TAU, d = (0.06 + hash(j * 4.7 + tick) * 0.16) * R;
        P.dot(tip.x + Math.cos(a) * d, tip.y + Math.sin(a) * d, 1.4, 'copper', (e - 0.5) * 1.6);
      }
    }
    if (stim > 0) {
      for (let j = 0; j < 3; j++) {
        const f = frac(t * 0.6 + j / 3);
        P.ring(T.x, T.y, f * R * 0.38, 'teal', (1 - f) * 0.7 * stim);
      }
    }
    return tip;
  }

  private drawShield(t: number, shield: number): void {
    if (shield <= 0) return;
    const c = this.ctx, { R, hx, hy } = this;
    c.save(); c.setLineDash([2, 7]); c.lineDashOffset = -t * 10;
    c.strokeStyle = css('teal', 0.55 * shield); c.beginPath(); c.arc(hx, hy - R * 0.05, R * 1.45, 0, TAU); c.stroke(); c.restore();
    this.paint.text('CLINICAL CORE · INTACT', hx, hy + R * 1.62, 'teal', 0.85 * shield, 11, 'center');
  }

  /** Countermanding task: fixate, look at the target, unless a stop signal appears. */
  private drawEyeInset(p: number, t: number, stop: number): void {
    const P = this.paint, I = this.inset;
    const inset = ease(seg(p, 0.08, 0.16));
    if (inset <= 0 || I.w <= 40) return;
    P.panel(I.x, I.y, I.w, I.h, stop > 0.5 ? 'red' : 'copper', inset);
    P.text(stop > 0.5 ? 'STOP-SIGNAL TASK' : 'VR · EYE TRACKING', I.x + 8, I.y + 10, stop > 0.5 ? 'red' : 'copper', 0.85 * inset, 9);
    const tr = trialAt(t);
    const fx = I.x + I.w / 2, fy = I.y + I.h * 0.58;
    const tx = I.x + I.w * (0.5 + 0.38 * tr.target), ty = I.y + I.h * (0.3 + 0.55 * hash(tr.k * 5.9));
    let gx = fx, gy = fy;
    P.dot(fx, fy, 2, 'white', (tr.f < TARGET_ON ? 0.9 : 0.25) * inset);
    if (tr.f >= TARGET_ON) P.dot(tx, ty, 3.5, 'white', 0.9 * inset);
    if (tr.stop && tr.f > STOP_ON) {
      const pulse = 1 + 0.6 * stop * Math.exp(-(((tr.f - STOP_ON) * TRIAL) / 0.15));
      this.ctx.fillStyle = css('red', 0.9 * inset); this.ctx.fillRect(fx - 4 * pulse, fy - 4 * pulse, 8 * pulse, 8 * pulse);
      P.text('STOP', fx + 9, fy, 'red', 0.9 * inset, 9);
      if (stop > 0.01) P.glow(fx, fy, 30 * burstAt(t) + 4, 'copper', 0.6 * stop * burstAt(t));
    } else if (tr.f > SACCADE) {
      const u = ease(clamp((tr.f - SACCADE) / 0.06));
      gx = lerp(fx, tx, u); gy = lerp(fy, ty, u);
    }
    P.ring(gx, gy, 5, 'teal', 0.9 * inset);
    this.mark('eye', I.x + I.w, I.y + I.h * 0.5);
  }

  /** The research platform's tap from the patient to the streams panel. */
  private drawTap(t: number, a: number): void {
    if (a <= 0) return;
    const c = this.ctx, Pn = this.panel;
    const from = this.narrow ? this.H(0.3, 1.05) : this.H(1.1, -0.1);
    const to = this.narrow ? { x: Pn.x + Pn.w * 0.3, y: Pn.y - 6 } : { x: Pn.x - 8, y: Pn.y + Pn.h * 0.5 };
    c.save(); c.setLineDash([2, 6]); c.lineDashOffset = -t * 20;
    c.strokeStyle = css('copper', 0.5 * a); c.beginPath(); c.moveTo(from.x, from.y);
    c.quadraticCurveTo(this.narrow ? from.x : (from.x + to.x) / 2, this.narrow ? to.y - 20 : from.y, to.x, to.y);
    c.stroke(); c.restore();
  }

  /** Three lanes on one time axis; during the stop-signal beat, bursts and epochs light up. */
  private drawStreams(t: number, a: number, sync: number, stop: number): void {
    if (a <= 0.01) return;
    const P = this.paint, c = this.ctx, Pn = this.panel;
    const lanesH = Pn.h * lerp(1, 0.62, stop);
    const sig = this.neural.signal, beta = this.neural.band(1);
    const t0 = t - LANE_SECONDS, X = (tt: number) => Pn.x + ((tt - t0) / LANE_SECONDS) * Pn.w;
    STREAMS.forEach((s, k) => {
      const ly = Pn.y + (lanesH * (k + 0.55)) / 3, amp = (lanesH / 3) * 0.28;
      const drift = s.offset * (1 - sync);
      P.text(s.name, Pn.x, ly - amp - 12, s.hue, 0.85 * a, 10);
      c.beginPath();
      const step = k === 0 ? 1.5 : 3;
      for (let x = 0; x <= Pn.w; x += step) {
        const tt = t0 + (x / Pn.w) * LANE_SECONDS - drift;
        const v = k === 0 ? sig[this.sampleAt(tt)] * 0.3 : k === 1 ? -gazeAt(tt) * 0.8 : Math.sin(tt * 4.5) * 0.5 + Math.sin(tt * 11 + 1) * 0.22;
        x === 0 ? c.moveTo(Pn.x + x, ly + v * amp) : c.lineTo(Pn.x + x, ly + v * amp);
      }
      c.strokeStyle = css(s.hue, 0.85 * a); c.stroke();
      // Stop-provoked beta bursts, drawn over the raw trace.
      if (k === 0 && stop > 0.01) {
        c.beginPath();
        for (let x = 0; x <= Pn.w; x += 1.5) {
          const tt = t0 + (x / Pn.w) * LANE_SECONDS, b = burstAt(tt);
          const v = beta[this.sampleAt(tt)] * (0.4 + 3 * b) * 0.3;
          x === 0 ? c.moveTo(Pn.x + x, ly + v * amp) : c.lineTo(Pn.x + x, ly + v * amp);
        }
        c.strokeStyle = css('amber', 0.9 * stop * a); c.lineWidth = 1.4; c.stroke(); c.lineWidth = 1;
      }
      // Stop signals on the eye lane.
      if (k === 1 && stop > 0.01) {
        for (let kk = Math.floor(t0 / TRIAL); kk <= Math.floor(t / TRIAL); kk++) {
          if (!isStop(kk)) continue;
          const st = (kk + STOP_ON) * TRIAL;
          if (st < t0 || st > t) continue;
          P.line(X(st), Pn.y, X(st), Pn.y + lanesH, 'red', 0.5 * stop * a, 1, [2, 3]);
          P.text('STOP', X(st) + 4, ly - amp - 2, 'red', stop * a, 9);
          P.text('β BURST', X(st + 0.22) + 4, Pn.y + lanesH / 6 - amp - 2, 'amber', stop * a * burstAt(st + 0.22), 9);
        }
      }
      // This lane's clock ticks drift until sync locks them to one grid.
      const per = lerp(s.period, COMMON_PERIOD, sync);
      for (let m = Math.ceil((t0 - drift) / per); ; m++) {
        const x = X(m * per + drift);
        if (x > Pn.x + Pn.w) break;
        P.line(x, ly + amp + 6, x, ly + amp + 12, s.hue, 0.5 * a);
      }
    });
    if (sync > 0.85) {
      const g = ((sync - 0.85) / 0.15) * a;
      for (let m = Math.ceil(t0 / COMMON_PERIOD); ; m++) {
        const x = X(m * COMMON_PERIOD);
        if (x > Pn.x + Pn.w) break;
        P.line(x, Pn.y, x, Pn.y + lanesH, 'teal', 0.18 * g);
      }
      P.text('COMMON CLOCK', Pn.x + Pn.w, Pn.y - 6, 'teal', 0.9 * g, 10, 'right');
    }
    const epochBox = { x: Pn.x, y: Pn.y + lanesH + 18, w: Pn.w, h: Pn.h - lanesH - 18 };
    if (stop > 0.01) this.drawEpochs(t, stop * a, epochBox);
    if (this.time.hold !== null) this.drawPauseNotes(this.time.hold, X, lanesH, epochBox, a * this.time.frozen);
    this.mark('streams', Pn.x + Pn.w * 0.5, Pn.y);
  }

  /** While frozen on a stop signal: highlight it and the burst it provokes, and say what to look for. */
  private drawPauseNotes(st: number, X: (tt: number) => number, lanesH: number, epochs: Box, a: number): void {
    if (a <= 0.02) return;
    const P = this.paint, c = this.ctx, Pn = this.panel, nar = this.narrow;
    const x0 = X(st), x1 = X(st + 0.5);
    c.fillStyle = css('amber', 0.1 * a);
    c.fillRect(x0, Pn.y, Math.max(0, Math.min(x1, Pn.x + Pn.w) - x0), lanesH);
    P.line(x0, Pn.y - 4, x0, Pn.y + lanesH, 'red', 0.9 * a, 1.5);
    const laneY = (k: number) => Pn.y + (lanesH * (k + 0.55)) / 3;
    const callout = (n: number, x: number, y: number, text: string, hue: 'red' | 'amber') => {
      const size = nar ? 9 : 10, w = P.measure(text, size) + 34;
      const bx = clamp(x - w / 2, Pn.x, Pn.x + Pn.w - w), by = y;
      P.panel(bx, by, w, 20, hue, a, 10);
      P.dot(bx + 11, by + 10, 7, hue, a);
      P.text(String(n), bx + 11, by + 10, 'ink', a, 9, 'center');
      P.text(text, bx + 24, by + 10, 'white', a, size);
    };
    callout(1, x0, laneY(1) + (lanesH / 3) * 0.32, 'Stop signal: the eyes hold still', 'red');
    callout(2, X(st + 0.22), laneY(0) - (lanesH / 3) * 0.62, '~200 ms later: a burst of beta', 'amber');
    callout(3, epochs.x + epochs.w * 0.5, epochs.y - 12, 'Cut out at the stop, stacked for training', 'amber');
    P.text('PAUSED · SCROLL TO CONTINUE', Pn.x + Pn.w, Pn.y + Pn.h + 14, 'grey', 0.8 * a, nar ? 8 : 9, 'right');
  }

  /** Stop-locked epochs stack up: a controlled onset turns bursts into training data. */
  private drawEpochs(t: number, a: number, B: Box): void {
    const P = this.paint, c = this.ctx, beta = this.neural.band(1);
    const stops: number[] = [];
    for (let k = Math.floor(t / TRIAL); stops.length < 6 && k > Math.floor(t / TRIAL) - 60; k--) {
      const st = (k + STOP_ON) * TRIAL;
      if (isStop(k) && st + 0.5 < t) stops.push(st);
    }
    P.panel(B.x, B.y, B.w, B.h, 'amber', a * 0.7, 8);
    P.text('STOP-LOCKED EPOCHS → TRAINING SET', B.x + 10, B.y + 11, 'amber', a, this.narrow ? 8 : 9);
    const rows = 6, rh = (B.h - 24) / rows;
    stops.forEach((st, i) => {
      const y = B.y + 20 + rh * (i + 0.5), age = clamp((t - st - 0.5) / 0.4);
      c.beginPath();
      for (let x = 0; x <= B.w - 20; x += 2) {
        const u = x / (B.w - 20), tt = st - 0.1 + u * 0.6;
        const v = beta[(Math.floor(tt * 997) % 4000 + 4000) % 4000 + 2000] * (0.3 + 2.4 * burstAt(tt)) * 0.18;
        x === 0 ? c.moveTo(B.x + 10 + x, y + v * rh) : c.lineTo(B.x + 10 + x, y + v * rh);
      }
      c.strokeStyle = css('amber', a * (i === 0 ? age : 0.75 - i * 0.08)); c.stroke();
    });
    const zero = B.x + 10 + (0.1 / 0.6) * (B.w - 20);
    P.line(zero, B.y + 20, zero, B.y + B.h - 4, 'red', 0.5 * a, 1, [2, 3]);
    this.mark('epochs', B.x + B.w * 0.7, B.y);
  }

  /** The live Welch spectrum, its aperiodic fit, and the patient's own beta band above it. */
  private drawSpectrum(p: number, t: number, spec: number, stim: number, cmp: number): void {
    const P = this.paint, c = this.ctx, Pn = this.panel, nar = this.narrow;
    const { freqs, power, aperiodic } = this.neural;
    const fit = this.neural.fit();
    for (let k = 0; k < power.length; k++) {
      this.shownPower[k] = lerp(this.shownPower[k], power[k], 0.12);
      this.shownAperiodic[k] = lerp(this.shownAperiodic[k], aperiodic[k], 0.12);
    }
    const [lo, hi] = this.range ?? [-4, 0];
    const ph = Pn.h * (nar ? 1 : 0.64);
    const X = (f: number) => Pn.x + (Pn.w * Math.log(f / 2)) / Math.log(50);
    const Y = (pw: number) => Pn.y + ph * 0.9 - ((pw - lo) / (hi - lo)) * ph * 0.8;
    const drawn = ease(seg(p, 0.49, 0.58));
    const fmax = 2 * Math.pow(50, drawn);
    const bins: number[] = [];
    for (let k = 0; k < freqs.length; k++) if (freqs[k] >= 2 && freqs[k] <= Math.min(100, fmax)) bins.push(k);

    // Out-of-focus reference: the simulated recording, with the analysis window sliding along it.
    const sig = this.neural.signal, span = 3000, ry = Pn.y + ph * 0.8, rAmp = ph * 0.08;
    c.save();
    c.filter = 'blur(1.4px)';
    c.beginPath();
    for (let x = 0; x <= Pn.w; x += 2) {
      const v = sig[this.sampleAt(t - (1 - x / Pn.w) * (span / FS))];
      x === 0 ? c.moveTo(Pn.x + x, ry + v * rAmp * 0.35) : c.lineTo(Pn.x + x, ry + v * rAmp * 0.35);
    }
    c.strokeStyle = css('copper', 0.3 * spec); c.stroke();
    c.restore();
    P.text('RECORDING', Pn.x + 2, ry - rAmp - 6, 'copper', 0.35 * spec, 8);
    const winW = (1024 / span) * Pn.w, winX = Pn.x + frac(t / 6) * (Pn.w - winW);
    c.fillStyle = css('white', 0.03 * spec); c.fillRect(winX, ry - rAmp, winW, rAmp * 2);
    P.line(winX, ry - rAmp, winX, ry + rAmp, 'white', 0.12 * spec);
    P.line(winX + winW, ry - rAmp, winX + winW, ry + rAmp, 'white', 0.12 * spec);
    P.text('WINDOW → SPECTRUM', winX + winW / 2, ry + rAmp + 7, 'white', 0.3 * spec, 8, 'center');

    const engine = kernels().backend === 'rust-wasm' ? 'RUST · WEBASSEMBLY' : 'TYPESCRIPT';
    P.text('POWER SPECTRUM · APERIODIC + PERIODIC FIT', Pn.x, Pn.y - 22, 'white', 0.7 * spec, 10);
    P.text(`SIMULATED · COMPUTED LIVE IN YOUR BROWSER · ${engine}`, Pn.x, Pn.y - 8, 'grey', 0.75 * spec, nar ? 7 : 9);

    // Broad beta (dim) and the patient-specific band FOOOF finds (bright).
    const [b0, b1] = this.band;
    c.fillStyle = css('copper', 0.05 * spec); c.fillRect(X(13), Pn.y + 4, X(30) - X(13), ph * 0.86);
    P.text('BROAD β 13–30', (X(13) + X(30)) / 2, Pn.y + 14, 'copper', 0.55 * spec, 9, 'center');
    const fooof = ease(seg(p, 0.54, 0.6)) * spec;
    if (fooof > 0.01) {
      c.fillStyle = css('copper', 0.16 * fooof); c.fillRect(X(b0), Pn.y + 24, X(b1) - X(b0), ph * 0.82);
      P.line(X(b0), Pn.y + 24, X(b0), Pn.y + ph * 0.86, 'copper', 0.8 * fooof);
      P.line(X(b1), Pn.y + 24, X(b1), Pn.y + ph * 0.86, 'copper', 0.8 * fooof);
      P.text(`PATIENT β ${b0.toFixed(0)}–${b1.toFixed(0)} Hz · FOOOF`, X(b1) + 6, Pn.y + 34, 'copper', fooof, nar ? 8 : 10);
    }
    const band = bins.filter((k) => freqs[k] >= b0 && freqs[k] <= b1);
    if (band.length > 1) {
      c.beginPath();
      band.forEach((k, i) => { const x = X(freqs[k]), y = Y(Math.max(this.shownPower[k], this.shownAperiodic[k])); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      for (let i = band.length - 1; i >= 0; i--) c.lineTo(X(freqs[band[i]]), Y(this.shownAperiodic[band[i]]));
      c.fillStyle = css('copper', 0.45 * spec); c.fill();
    }
    const line = (vals: Float32Array, hue: 'grey' | 'white', a: number, width: number, dash?: number[]) => {
      c.save(); if (dash) c.setLineDash(dash);
      c.strokeStyle = css(hue, a); c.lineWidth = width; c.beginPath();
      if (bins.length > 1) P.smooth(bins.map((k) => ({ x: X(freqs[k]), y: Y(vals[k]) })));
      c.stroke(); c.restore();
    };
    line(this.shownAperiodic, 'grey', 0.6 * spec, 1, [4, 4]);
    line(this.shownPower, 'white', 0.9 * spec, 1.6);
    [4, 10, 20, 50, 100].forEach((f) => P.text(String(f), X(f), Pn.y + ph * 0.96, 'grey', 0.7 * spec, 9, 'center'));
    const pk = clamp(fit.peakHz, 13, 30), pkY = Y(this.shownAperiodic[Math.round(pk / (freqs[1] || 1))] + fit.peakHeight);
    if (drawn > 0.6) P.text(stim > 0.5 ? 'PEAK SUPPRESSED' : 'THIS PATIENT’S PEAK', X(pk) - 8, Math.max(Pn.y + 50, pkY - 14), stim > 0.5 ? 'teal' : 'copper', spec * seg(drawn, 0.6, 1), 10, 'right');
    if (drawn > 0.8) P.text(`1/f EXP ${fit.exponent.toFixed(2)} · β PEAK ${fit.peakHz.toFixed(1)} Hz · R² ${fit.r2.toFixed(2)}`, Pn.x + Pn.w, Pn.y + ph + 4, 'grey', 0.75 * spec * seg(drawn, 0.8, 1), nar ? 8 : 9, 'right');
    this.mark('peak', X(pk + 5), pkY);
    this.mark('band', X(b1), Pn.y + 40);

    if (!nar && cmp > 0.01) this.drawComparison(t, cmp * spec, { x: Pn.x, y: Pn.y + ph + 30, w: Pn.w, h: Pn.h - ph - 18 });
    if (stim > 0 && !nar) {
      STIM.forEach((row, k) => {
        const y = Pn.y + ph + 26 + k * 22, x0 = Pn.x + 96, x1 = Pn.x + Pn.w - 70;
        P.text(row.name, Pn.x, y, 'teal', 0.8 * stim, 10);
        P.line(x0, y, x1, y, 'teal', 0.25 * stim);
        const kx = lerp(x0, x1, lerp(row.from, row.to, stim));
        P.line(x0, y, kx, y, 'teal', 0.9 * stim, 2);
        P.dot(kx, y, 4, 'teal', stim);
        P.text(row.value, Pn.x + Pn.w, y, 'white', 0.8 * stim, 10, 'right');
      });
      this.mark('stim', Pn.x, Pn.y + ph + 26);
    }
  }

  /** The same recording filtered two ways: the patient's narrow band keeps the bursts crisp. */
  private drawComparison(t: number, a: number, B: Box): void {
    const P = this.paint, c = this.ctx;
    const rows: { slot: 0 | 1; label: string; hue: Hue; score: number }[] = [
      { slot: 0, label: 'BROAD 13–30 Hz', hue: 'grey', score: 0.4 },
      { slot: 1, label: `PATIENT ${this.band[0].toFixed(0)}–${this.band[1].toFixed(0)} Hz`, hue: 'copper', score: 0.85 },
    ];
    const rh = B.h / 2, labelW = 128, barW = 60, w = B.w - labelW - barW - 16;
    rows.forEach((r, i) => {
      const y = B.y + rh * (i + 0.5), sigv = this.neural.band(r.slot), env = this.neural.envelope(r.slot);
      P.text(r.label, B.x, y - 6, r.hue === 'grey' ? 'white' : 'copper', 0.85 * a, 9);
      P.text(i === 0 ? 'noise dilutes the bursts' : 'bursts stand out', B.x, y + 7, 'grey', 0.7 * a, 9);
      const amp = rh * 0.3;
      const trace = (vals: Float32Array, hue: Hue, alpha: number, k: number) => {
        c.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const v = vals[this.sampleAt(t - (1 - x / w) * 2)] * k;
          x === 0 ? c.moveTo(B.x + labelW + x, y - v * amp) : c.lineTo(B.x + labelW + x, y - v * amp);
        }
        c.strokeStyle = css(hue, alpha); c.stroke();
      };
      trace(sigv, r.hue, 0.55 * a, 0.9);
      trace(env, r.hue === 'grey' ? 'white' : 'amber', 0.95 * a, 0.9);
      // Qualitative: how well each band tracks the patient's motor state.
      const bx = B.x + B.w - barW;
      P.line(bx, y, bx + barW, y, 'grey', 0.3 * a, 4);
      P.line(bx, y, bx + barW * r.score * a, y, r.hue === 'grey' ? 'white' : 'copper', 0.9 * a, 4);
    });
    P.text('TRACKS MOTOR STATE', B.x + B.w, B.y + 2, 'grey', 0.7 * a, 8, 'right');
    this.mark('compare', B.x + labelW + w * 0.5, B.y);
  }
}
