import { Scene } from '../core/scene';
import { clamp, ease, frac, hash, lerp, seg, vnoise, type Box, type Point } from '../core/math';
import { css, mix, type Hue } from '../core/color';

type Kind = 'llm' | 'tool' | 'handoff';
interface Span { start: number; dur: number; depth: number; label: string; kind: Kind; meta: string }

/** One alarm, end to end: the call stack an engineer can open from any answer. */
const RUN: Span[] = [
  { start: 0, dur: 420, depth: 0, label: 'Router · reason', kind: 'llm', meta: '420 ms · 812 tok' },
  { start: 420, dur: 24, depth: 0, label: '→ handoff: Fault detection', kind: 'handoff', meta: '' },
  { start: 444, dur: 606, depth: 1, label: 'Fault detection · reason', kind: 'llm', meta: '606 ms · 1,204 tok' },
  { start: 1050, dur: 180, depth: 2, label: 'query_trends(AHU-3, 24h)', kind: 'tool', meta: '180 ms · ok' },
  { start: 1230, dur: 95, depth: 2, label: 'get_alarm_history(AHU-3)', kind: 'tool', meta: '95 ms · ok' },
  { start: 1325, dur: 375, depth: 1, label: 'Fault detection · conclude', kind: 'llm', meta: '375 ms · 640 tok' },
  { start: 1700, dur: 24, depth: 1, label: '→ handoff: Diagnostics', kind: 'handoff', meta: '' },
  { start: 1724, dur: 536, depth: 2, label: 'Diagnostics · reason', kind: 'llm', meta: '536 ms · 1,088 tok' },
  { start: 2260, dur: 220, depth: 3, label: 'run_procedure(sat_high)', kind: 'tool', meta: '220 ms · ok' },
  { start: 2480, dur: 24, depth: 2, label: '→ handoff: Work orders', kind: 'handoff', meta: '' },
  { start: 2504, dur: 140, depth: 3, label: 'create_work_order(P2)', kind: 'tool', meta: '140 ms · ok' },
  { start: 2644, dur: 206, depth: 0, label: 'Router · respond', kind: 'llm', meta: '206 ms · 1,068 tok' },
];
const RUN_MS = 3000;
const KIND_HUE: Record<Kind, Hue> = { llm: 'violet', tool: 'sky', handoff: 'teal' };

const GATES = ['PR BUILD', 'CANARY', 'LIVE'];
const SCENARIOS = ['AHU fault triage', 'Lab pressure alarm', 'Unknown tag → refuse', 'Unsafe write → confirm'];

interface Metric { name: string; hue: Hue; better: 'up' | 'down'; value: (b: number) => number }
const BUILDS = 30;
const DATA_REG = 12, CODE_REG = 20, REVERT = 22, RELEASE = 26;
/** Synthetic metrics over builds, with one data regression, one code regression and a post-trained release. */
const METRICS: Metric[] = [
  { name: 'TASK SUCCESS', hue: 'teal', better: 'up', value: (b) => 0.62 + b * 0.004 - (b >= DATA_REG && b < DATA_REG + 3 ? 0.22 : 0) + (b >= RELEASE ? 0.12 : 0) },
  { name: 'GROUNDEDNESS', hue: 'mint', better: 'up', value: (b) => 0.7 - (b >= DATA_REG && b < DATA_REG + 3 ? 0.18 : 0) + (b >= RELEASE ? 0.06 : 0) },
  { name: 'LATENCY P95', hue: 'sky', better: 'down', value: (b) => 0.55 + (b >= CODE_REG && b < REVERT ? 0.3 : 0) - (b >= RELEASE ? 0.2 : 0) },
  { name: 'TOKENS / DECISION', hue: 'amber', better: 'down', value: (b) => 0.6 + (b >= CODE_REG && b < REVERT ? 0.22 : 0) - (b >= RELEASE ? 0.28 : 0) },
];

/**
 * Observability as zoom levels: one run's call stack, the swarm it lives in,
 * the evaluation gates the swarm passes, and the metrics every change publishes.
 */
export class ObserveScene extends Scene {
  draw(p: number, t: number): void {
    const V = this.box;
    const play = seg(p, 0.03, 0.24);
    const zoom1 = ease(seg(p, 0.3, 0.44));
    const zoom2 = ease(seg(p, 0.52, 0.62));
    const dash = ease(seg(p, 0.7, 0.76));
    const fadeC = 1 - dash;

    const swarmC = { x: lerp(V.x + V.w * 0.5, V.x + V.w * (this.narrow ? 0.14 : 0.12), zoom2), y: V.y + V.h * (this.narrow ? 0.42 : 0.46) };
    const swarmS = lerp(1, 0.42, zoom2);
    const full: Box = { x: V.x + 6, y: V.y + V.h * 0.06, w: V.w - 12, h: V.h * 0.82 };
    const tileW = Math.min(V.w, V.h) * 0.16 * swarmS, tileH = tileW * 0.62;
    const tile: Box = { x: swarmC.x - tileW / 2, y: swarmC.y - tileH / 2, w: tileW, h: tileH };
    const g: Box = { x: lerp(full.x, tile.x, zoom1), y: lerp(full.y, tile.y, zoom1), w: lerp(full.w, tile.w, zoom1), h: lerp(full.h, tile.h, zoom1) };

    if (fadeC > 0.01) {
      this.ctx.globalAlpha = fadeC;
      if (zoom1 > 0.01) this.drawSwarm(swarmC, swarmS, zoom1, t);
      if (zoom2 > 0.01) this.drawGates(swarmC, zoom2, t);
      this.drawGantt(g, play, 1 - ease(clamp(zoom1 * 2.2)), zoom1);
      this.ctx.globalAlpha = 1;
    }
    if (dash > 0.01) this.drawDashboard(seg(p, 0.72, 0.96), dash, t);
  }

  private drawGantt(g: Box, play: number, detail: number, zoom: number): void {
    const P = this.paint, nar = this.narrow;
    const cursor = play * RUN_MS;
    const labelW = detail > 0.01 ? g.w * (nar ? 0.46 : 0.4) * detail : 0;
    const bx = g.x + labelW, bw = g.w - labelW;
    const top = g.y + (detail > 0.01 ? 34 * detail : 0);
    const rh = (g.h - (top - g.y)) / RUN.length;
    if (zoom > 0.02) P.panel(g.x - 4, g.y - 4, g.w + 8, g.h + 8, 'copper', zoom, 6);
    if (detail > 0.01) {
      P.text('CALL STACK · ONE ALARM, END TO END', g.x, g.y + 6, 'white', 0.8 * detail, nar ? 8 : 10);
      const total = Math.min(cursor, 2850);
      P.text(`${(total / 1000).toFixed(2)} s · 4,812 tok · 5 tools`, g.x + g.w, g.y + 6, 'teal', 0.9 * detail * seg(play, 0.05, 0.2), nar ? 8 : 10, 'right');
      for (let s = 0; s <= 3; s++) {
        const x = bx + (s * 1000 / RUN_MS) * bw;
        P.line(x, top - 8, x, g.y + g.h, 'grey', 0.12 * detail);
        P.text(`${s}s`, x, top - 14, 'grey', 0.6 * detail, 9, 'center');
      }
      // Live playback cursor.
      if (play > 0 && play < 1) {
        const cx = bx + (cursor / RUN_MS) * bw;
        P.line(cx, top - 8, cx, g.y + g.h, 'white', 0.5 * detail);
      }
    }
    RUN.forEach((s, i) => {
      const y = top + i * rh;
      const shown = clamp((cursor - s.start) / s.dur);
      const started = cursor >= s.start || zoom > 0.5;
      const prog = zoom > 0.5 ? 1 : shown;
      const x0 = bx + (s.start / RUN_MS) * bw, w0 = Math.max(2, (s.dur / RUN_MS) * bw * prog);
      if (started) {
        this.ctx.fillStyle = css(KIND_HUE[s.kind], s.kind === 'handoff' ? 0.9 : 0.75);
        this.ctx.fillRect(x0, y + rh * 0.2, w0, Math.max(1.5, rh * 0.6));
        if (s.kind === 'handoff' && detail > 0.5) P.line(x0 + 1, y + rh * 0.8, x0 + 1, y + rh * 1.4, 'teal', 0.6 * detail);
      }
      if (detail > 0.01 && started) {
        const size = nar ? 8 : Math.min(11, rh * 0.5);
        P.text(s.label, g.x + s.depth * (nar ? 6 : 12), y + rh * 0.5, KIND_HUE[s.kind], 0.95 * detail, size);
        if (s.meta && shown >= 1 && !nar) P.text(s.meta, x0 + w0 + 6, y + rh * 0.5, 'grey', 0.8 * detail, size - 1);
      }
      if (i === 3) this.mark('span', x0 + w0, y + rh * 0.5);
    });
    if (zoom > 0.6) P.text('THIS RUN', g.x + g.w / 2, g.y - 12, 'copper', zoom, 9, 'center');
  }

  /** Many agents, each with a live mini call stack, handing work to each other. */
  private drawSwarm(c: Point, s: number, a: number, t: number): void {
    const P = this.paint, V = this.box, N = this.narrow ? 22 : 34;
    const R = Math.min(V.w, V.h) * 0.42 * s;
    const nodes: Point[] = [];
    for (let i = 1; i <= N; i++) {
      const r = Math.sqrt(i / N) * R, ang = i * 2.39996 + 0.4;
      nodes.push({ x: c.x + Math.cos(ang) * r * 1.25, y: c.y + Math.sin(ang) * r * 0.85 });
    }
    // Handoffs.
    for (let k = 0; k < N; k++) {
      const i = Math.floor(hash(k * 2.1) * N), j = Math.floor(hash(k * 5.3) * N);
      if (i === j) continue;
      const A = nodes[i], B = nodes[j];
      P.line(A.x, A.y, B.x, B.y, 'teal', 0.08 * a);
      const u = frac(t * 0.4 + hash(k));
      P.pixel(lerp(A.x, B.x, u), lerp(A.y, B.y, u), 2, 'teal', 0.7 * a * Math.sin(u * Math.PI));
    }
    const tw = Math.max(10, 26 * s), th = tw * 0.62;
    nodes.forEach((n, i) => {
      P.roundRect(n.x - tw / 2, n.y - th / 2, tw, th, 3);
      this.ctx.fillStyle = css('ink', 0.9 * a); this.ctx.fill();
      this.ctx.strokeStyle = css('teal', 0.35 * a); this.ctx.stroke();
      for (let b = 0; b < 4; b++) {
        const tick = Math.floor(t * 1.5 + hash(i) * 10);
        const st = hash(tick + i * 7 + b) * 0.5, ln = 0.15 + hash(tick * 3 + i + b) * 0.4;
        this.ctx.fillStyle = css(b % 2 ? 'sky' : 'violet', 0.7 * a);
        this.ctx.fillRect(n.x - tw / 2 + 2 + st * (tw - 4), n.y - th / 2 + 2 + b * ((th - 4) / 4), ln * (tw - 4) * (1 - st), Math.max(1, (th - 4) / 4 - 1));
      }
    });
    P.text('AGENT SWARM · LIVE', c.x, c.y - R * 0.85 - 14, 'teal', 0.85 * a, this.narrow ? 8 : 10, 'center');
    this.mark('swarm', c.x + R * 0.9, c.y - R * 0.5);
  }

  /** Promotion rings as gates in series, scored against business-critical scenarios. */
  private drawGates(from: Point, a: number, t: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const xs = GATES.map((_, i) => V.x + V.w * (0.4 + i * 0.22));
    const gy = V.y + V.h * 0.42, gh = V.h * 0.15;
    // Packets crossing the gates.
    for (let j = 0; j < 40; j++) {
      const u = frac(hash(j) + t * 0.1), x = lerp(from.x + 30, V.x + V.w, u);
      const y = gy + (hash(j * 3.3) - 0.5) * gh * 1.2;
      P.pixel(x, y, 2, mix('copper', 'teal', clamp((x - xs[0]) / (xs[2] - xs[0]))), 0.7 * a);
    }
    xs.forEach((x, i) => {
      this.ctx.strokeStyle = css('teal', 0.65 * a); this.ctx.lineWidth = 1.5;
      this.ctx.beginPath(); this.ctx.ellipse(x, gy, 12, gh, 0, 0, Math.PI * 2); this.ctx.stroke(); this.ctx.lineWidth = 1;
      P.text(GATES[i], x, gy - gh - 14, 'teal', 0.9 * a, nar ? 8 : 10, 'center');
    });
    this.mark('gates', xs[0] + 12, gy - gh * 0.6);
    // Scenario matrix: rows of business-critical scenarios, a check per gate.
    const top = V.y + V.h * 0.72, rh = Math.min(24, V.h * 0.06);
    const labelX = nar ? V.x + 8 : xs[0] - V.w * 0.26;
    P.text('BUSINESS-CRITICAL SCENARIOS', labelX, top - rh * 0.8, 'white', 0.75 * a, nar ? 8 : 10);
    SCENARIOS.forEach((s, r) => {
      const y = top + r * rh;
      P.text(s, labelX, y, 'grey', 0.9 * a, nar ? 8 : 11);
      xs.forEach((x, i) => {
        const lit = seg(a, 0.3 + i * 0.2 + r * 0.03, 0.4 + i * 0.2 + r * 0.03);
        P.text(lit > 0.5 ? '✓' : '·', x, y, lit > 0.5 ? 'teal' : 'grey', a * (0.4 + 0.6 * lit), nar ? 11 : 13, 'center');
      });
    });
  }

  /** Metrics published over builds; each regression is attributed to data or code. */
  private drawDashboard(d: number, a: number, t: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const cols = 2, gap = nar ? 12 : 22;
    const cw = (V.w - gap * (cols + 1)) / cols, ch = (V.h * (this.narrow ? 0.82 : 0.68) - gap * 3) / 2;
    const reach = d * (BUILDS - 1);
    P.text('EVALUATION SUITE · PUBLISHED WITH EVERY CHANGE', V.x + gap, V.y + 8, 'white', 0.8 * a, nar ? 8 : 10);
    METRICS.forEach((m, i) => {
      const bx = V.x + gap + (i % cols) * (cw + gap), by = V.y + 26 + gap + Math.floor(i / cols) * (ch + gap);
      P.panel(bx, by, cw, ch, m.hue, a * 0.6, 8);
      P.text(m.name, bx + 10, by + 12, m.hue, a, nar ? 8 : 10);
      P.text(m.better === 'up' ? '↑ better' : '↓ better', bx + cw - 10, by + 12, 'grey', 0.7 * a, nar ? 8 : 9, 'right');
      const px = (b: number) => bx + 10 + (b / (BUILDS - 1)) * (cw - 20);
      const py = (v: number) => by + ch - 10 - clamp(v) * (ch - 34);
      // Regression markers.
      ([[DATA_REG, 'DATA', 'amber'], [CODE_REG, 'CODE', 'red'], [RELEASE, 'POST-TRAINED', 'copper']] as const).forEach(([b, lbl, hue]) => {
        if (reach < b) return;
        const affected = lbl === 'DATA' ? i < 2 : lbl === 'CODE' ? i >= 2 : true;
        P.line(px(b), by + 24, px(b), by + ch - 8, hue, (affected ? 0.6 : 0.15) * a, 1, [2, 3]);
        if (affected && (i === 0 || i === 2)) P.text(lbl, px(b) + 4, by + 30, hue, 0.9 * a, nar ? 7 : 9);
      });
      P.plot((u) => {
        const b = u * (BUILDS - 1);
        const bi = Math.floor(b), bf = b - bi;
        const v = lerp(m.value(bi), m.value(Math.min(BUILDS - 1, bi + 1)), ease(bf)) + vnoise(b * 1.7 + i * 5) * 0.015;
        return { x: px(b), y: py(v) };
      }, 200, m.hue, 0.95 * a, 1.6, d);
      const head = Math.min(reach, BUILDS - 1);
      P.dot(px(head), py(m.value(Math.floor(head))), 3, m.hue, a * (0.6 + 0.4 * Math.sin(t * 4)));
      if (i === 0) this.mark('regression', px(DATA_REG), py(m.value(DATA_REG)));
      if (i === 3) this.mark('release', px(RELEASE), py(m.value(RELEASE)));
    });
  }
}
