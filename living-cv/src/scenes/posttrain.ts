import { Scene } from '../core/scene';
import { TAU, clamp, ease, frac, hash, lerp, seg, vnoise } from '../core/math';
import { css, mix, type Hue } from '../core/color';
import { IsoBuilding } from './shared/iso';

/** An illustrative proprietary point tag and what each part means. */
const TAG = [
  { s: 'R', label: 'REGION' },
  { s: 'B41', label: 'BUILDING' },
  { s: 'AHU', label: 'AIR HANDLER' },
  { s: '03', label: 'FLOOR' },
  { s: '02', label: 'UNIT #' },
  { s: 'SAT', label: 'SUPPLY AIR TEMP' },
];
const ASK = 'Operator: reset CTF.02.VFD.01.RST and set DMP.03 to 9.';
const GENERIC = 'Sure! Resetting the counter on CTF.02 and setting the damper to 9%.';
const FLAGS = ['RST is a physical output: it restarts a supply-fan drive. High severity.', 'DMP.03 is scaled 0–10. "9" means 90% open, not 9%.'];
const TRAINED = [
  'CTF.02.VFD.01.RST restarts supply-fan drive VFD-01 on floor 2.',
  'Physical output, high severity: please confirm before I act.',
  'DMP.03 is scaled 0–10, so 9 means 90% open.',
];
const PIPELINE: { name: string; sub: string; hue: Hue }[] = [
  { name: 'REAL DATA', sub: 'telemetry + taxonomy', hue: 'grey' },
  { name: 'SIMULATE', sub: 'critical scenarios', hue: 'sky' },
  { name: 'SFT', sub: 'learns the words', hue: 'violet' },
  { name: 'GRPO', sub: 'learns the rules', hue: 'copper' },
  { name: 'RLCD', sub: 'calibrated decisions', hue: 'amber' },
  { name: 'EVAL GATE', sub: 'promote or stop', hue: 'teal' },
];

/** Visible window with soft edges. */
const win = (p: number, a: number, b: number, f = 0.03) => seg(p, a, a + f) * (1 - seg(p, b - f, b));

/**
 * Why post-training: a proprietary tag a generic model misreads dangerously, the training loop
 * that fixes it, the corrected answer, and the campus of autonomous agents it enables.
 */
export class PostTrainScene extends Scene {
  draw(p: number, t: number): void {
    const A = win(p, -1, 0.25), B = win(p, 0.21, 0.47), C = win(p, 0.45, 0.72), D = win(p, 0.7, 0.87), E = seg(p, 0.85, 0.89);
    if (A > 0.01) this.drawTag(p, A);
    if (B > 0.01) this.drawGeneric(p, t, B);
    if (C > 0.01) this.drawPipeline(seg(p, 0.46, 0.68), t, C);
    if (D > 0.01) this.drawTrained(seg(p, 0.7, 0.82), D);
    if (E > 0.01) this.drawCampus(seg(p, 0.86, 0.98), t, E);
  }

  /** Text in a HUD bubble; returns its height. */
  private bubble(x: number, y: number, w: number, text: string | string[], edge: Hue, a: number, size: number, fg: Hue = 'white'): number {
    const lines = (Array.isArray(text) ? text : [text]).flatMap((s) => this.paint.wrap(s, w - 24, size));
    const lh = size * 1.5, h = lines.length * lh + 18;
    this.paint.panel(x, y, w, h, edge, a, 10);
    lines.forEach((l, i) => this.paint.text(l, x + 12, y + 9 + lh * (i + 0.5), fg, a, size));
    return h;
  }

  private drawTag(p: number, a: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const size = nar ? 20 : Math.min(34, V.w * 0.045);
    const typed = seg(p, 0.02, 0.1), brackets = seg(p, 0.08, 0.2);
    const parts = TAG.map((x) => x.s);
    const full = parts.join('.');
    const total = P.measure(full, size);
    let x = V.x + V.w / 2 - total / 2;
    const y = V.y + V.h * 0.4;
    const chars = Math.floor(full.length * typed);
    let used = 0;
    TAG.forEach((seg2, i) => {
      const s = seg2.s + (i < TAG.length - 1 ? '.' : '');
      const visible = s.slice(0, Math.max(0, chars - used));
      used += s.length;
      const w = P.measure(seg2.s, size);
      P.text(visible, x, y, i === 5 ? 'copper' : 'white', a, size);
      const la = clamp(brackets * TAG.length - i);
      if (la > 0) {
        const by = y + size * 0.8, depth = 14 + (i % 2) * (nar ? 18 : 22);
        P.line(x, by, x + w, by, 'copper', 0.8 * la * a, 1.5);
        P.line(x + w / 2, by, x + w / 2, by + depth, 'copper', 0.5 * la * a);
        P.text(seg2.label, x + w / 2, by + depth + 9, 'copper', la * a, nar ? 7 : 10, 'center');
      }
      x += P.measure(s, size);
    });
    P.text('ONE POINT, IN ONE PROPRIETARY BMS DIALECT', V.x + V.w / 2, y - size * 1.6, 'grey', 0.8 * a * seg(p, 0.06, 0.12), nar ? 8 : 10, 'center');
    this.mark('tag', V.x + V.w / 2 + total / 2, y);
  }

  private drawGeneric(p: number, t: number, a: number): void {
    const P = this.paint, V = this.box, nar = this.narrow, size = nar ? 10 : 13;
    const bw = Math.min(V.w * 0.9, 560), x = V.x + (V.w - bw) / 2;
    const ask = seg(p, 0.22, 0.26), typed = seg(p, 0.27, 0.35), flags = seg(p, 0.35, 0.43);
    let y = V.y + V.h * 0.08;
    if (ask > 0) y += this.bubble(x, y, bw * 0.85, ASK, 'grey', a * ask, size) + 14;
    if (typed > 0) {
      const s = GENERIC.slice(0, Math.floor(GENERIC.length * typed)) + (typed < 1 && frac(t * 2) < 0.5 ? '▍' : '');
      P.text('GENERIC LLM', x + bw * 0.15, y + 2, 'red', 0.8 * a, 9);
      const h = this.bubble(x + bw * 0.15, y + 10, bw * 0.85, s, 'red', a, size);
      this.mark('generic', x + bw, y + 10 + h / 2);
      y += h + 30;
    }
    FLAGS.forEach((f, i) => {
      const fa = clamp(flags * 2 - i) * a;
      if (fa <= 0) return;
      const fy = y + i * (nar ? 46 : 52);
      P.text('✕', x + 8, fy + 14, 'red', fa, 16);
      this.bubble(x + 30, fy, bw - 30, f, 'red', fa, size - 1, 'red');
    });
  }

  private drawPipeline(c: number, t: number, a: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const n = PIPELINE.length, perRow = nar ? 3 : n;
    const nw = nar ? (V.w - 40) / 3 - 8 : (V.w - 30) / n - 12, nh = nar ? 44 : 54;
    const pos = PIPELINE.map((_, i) => ({
      x: V.x + 16 + (i % perRow) * (nw + (nar ? 12 : 14)),
      y: V.y + V.h * (nar ? 0.08 : 0.16) + Math.floor(i / perRow) * (nh + 40),
    }));
    // Connectors and flowing samples.
    for (let i = 0; i < n - 1; i++) {
      const A = pos[i], B = pos[i + 1], lit = clamp(c * n - i - 0.5);
      const sameRow = Math.floor(i / perRow) === Math.floor((i + 1) / perRow);
      const x0 = sameRow ? A.x + nw : A.x + nw / 2, y0 = sameRow ? A.y + nh / 2 : A.y + nh;
      const x1 = sameRow ? B.x : B.x + nw / 2, y1 = sameRow ? B.y + nh / 2 : B.y;
      P.line(x0, y0, x1, y1, 'grey', 0.3 * a);
      if (lit > 0) for (let k = 0; k < 3; k++) {
        const u = frac(t * 0.6 + k / 3);
        P.pixel(lerp(x0, x1, u), lerp(y0, y1, u), 3, PIPELINE[i + 1].hue, a * lit);
      }
    }
    PIPELINE.forEach((s, i) => {
      const lit = clamp(c * n - i);
      const q = pos[i];
      P.panel(q.x, q.y, nw, nh, s.hue, a * (0.35 + 0.65 * lit), 8);
      P.text(s.name, q.x + nw / 2, q.y + nh * 0.38, s.hue, a * (0.4 + 0.6 * lit), nar ? 10 : 13, 'center');
      P.text(s.sub, q.x + nw / 2, q.y + nh * 0.7, 'grey', a * (0.4 + 0.6 * lit), P.fit(s.sub, nw - 10, nar ? 8 : 10), 'center');
    });
    // Evaluation metrics feed the reward: a loop from the gate back to GRPO.
    const gate = pos[5], grpo = pos[3];
    const loop = clamp(c * n - 5) * a;
    if (loop > 0 && !nar) {
      const ly = gate.y + nh + 22;
      const c2 = this.ctx;
      c2.save(); c2.setLineDash([3, 4]); c2.lineDashOffset = t * 20; c2.strokeStyle = css('teal', 0.7 * loop);
      c2.beginPath(); c2.moveTo(gate.x + nw / 2, gate.y + nh); c2.lineTo(gate.x + nw / 2, ly); c2.lineTo(grpo.x + nw / 2, ly); c2.lineTo(grpo.x + nw / 2, grpo.y + nh); c2.stroke(); c2.restore();
      P.text('REWARD ← EVALUATION METRICS', (gate.x + grpo.x + nw) / 2, ly + 12, 'teal', loop, 10, 'center');
    }
    // Reward climbing under GRPO, calibration tightening under RLCD.
    const chartY = V.y + V.h * 0.56, chartH = V.h * (nar ? 0.3 : 0.34);
    const cw = Math.min((V.w - 44) / 2, 380);
    const rx = V.x + 16, ry = chartY;
    const ra = clamp(c * n - 3) * a;
    if (ra > 0) {
      P.panel(rx, ry, cw, chartH, 'copper', ra * 0.7, 8);
      P.text('GRPO REWARD', rx + 10, ry + 12, 'copper', ra, nar ? 8 : 10);
      P.plot((u) => ({ x: rx + 10 + u * (cw - 20), y: ry + chartH - 12 - (chartH - 36) * (0.15 + 0.7 * (1 - Math.exp(-u * 3.2)) + vnoise(u * 30) * 0.04) }), 120, 'copper', ra, 1.6, clamp(c * n - 3));
    }
    const ka = clamp(c * n - 4) * a;
    if (ka > 0) {
      const kx = rx + cw + 12;
      P.panel(kx, ry, cw, chartH, 'amber', ka * 0.7, 8);
      P.text('CALIBRATION · ACT / ASK / ESCALATE', kx + 10, ry + 12, 'amber', ka, P.fit('CALIBRATION · ACT / ASK / ESCALATE', cw - 20, 10));
      const px = (v: number) => kx + 12 + v * (cw - 24), py = (v: number) => ry + chartH - 12 - v * (chartH - 36);
      P.line(px(0), py(0), px(1), py(1), 'grey', 0.4 * ka, 1, [3, 3]);
      const tight = ease(clamp(c * n - 4.2));
      for (let i = 0; i < 10; i++) {
        const v = (i + 0.5) / 10, off = (hash(i * 3.7) - 0.5) * 0.5 * (1 - tight) + (v > 0.5 ? -0.15 : 0.1) * (1 - tight);
        P.dot(px(v), py(clamp(v + off)), 3, 'amber', ka);
      }
    }
    this.mark('pipeline', pos[3].x + nw / 2, pos[3].y + nh);
  }

  private drawTrained(d: number, a: number): void {
    const P = this.paint, V = this.box, nar = this.narrow, size = nar ? 10 : 13;
    const bw = Math.min(V.w * 0.9, 560), x = V.x + (V.w - bw) / 2;
    let y = V.y + V.h * 0.08;
    y += this.bubble(x, y, bw * 0.85, ASK, 'grey', a, size) + 14;
    const shown = TRAINED.slice(0, Math.ceil(TRAINED.length * clamp(d * 1.4)));
    P.text('POST-TRAINED SPECIALIST', x + bw * 0.15, y + 2, 'teal', 0.9 * a, 9);
    const h = this.bubble(x + bw * 0.15, y + 10, bw * 0.85, shown, 'teal', a, size);
    this.mark('trained', x + bw, y + 10 + h / 2);
    y += h + 30;
    const facts = ['Physical output recognised', 'Severity applied', 'Scale resolved: 9 → 90%', 'Fewer tool calls and tokens'];
    facts.forEach((f, i) => {
      const fa = clamp(d * 5 - 1 - i) * a;
      if (fa > 0) P.text(`✓ ${f}`, x + 12 + (nar ? 0 : (i % 2) * bw * 0.5), y + (nar ? i : Math.floor(i / 2)) * 22, 'teal', fa, size);
    });
  }

  /** Zoom out to a campus where swarms of agents run autonomously, every building watched. */
  private drawCampus(e: number, t: number, a: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const cols = nar ? 3 : 4, rows = 3;
    const zoom = lerp(1.5, 1, ease(e));
    const scale = Math.min(V.w, V.h) * (nar ? 0.022 : 0.02) * zoom;
    const cx = V.x + V.w * 0.5, cy = V.y + V.h * 0.62;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const appear = clamp(e * 3 - hash(i * 1.3) * 1.5) * a;
      if (appear <= 0) continue;
      const gx = (c - (cols - 1) / 2) * 7.2, gy = (r - (rows - 1) / 2) * 6.4;
      const o = { x: cx + (gx - gy) * 0.866 * scale, y: cy + (gx + gy) * 0.5 * scale };
      const floors = 3 + Math.floor(hash(i * 4.1) * 5);
      const b = new IsoBuilding(o, scale, floors);
      b.draw(P, floors * appear, 'teal', appear, 2);
      const roof = b.roof;
      for (let k = 0; k < 7; k++) {
        const ang = t * (0.6 + hash(i + k) * 0.8) + (k * TAU) / 7, rr = scale * (1.6 + hash(k * 3 + i) * 1.2);
        P.dot(roof.x + Math.cos(ang) * rr * 1.4, roof.y - scale * 1.2 + Math.sin(ang) * rr * 0.5, 1.6, mix('teal', 'white', hash(k)), 0.9 * appear);
      }
      P.glow(roof.x, roof.y - scale, scale * 3, 'teal', 0.18 * appear);
    }
    const chip = seg(e, 0.5, 0.8) * a;
    if (chip > 0) {
      const msg = 'AUTONOMOUS · OBSERVED · EVALUATED · 99.9%', size = nar ? 9 : 11;
      const tw = P.measure(msg, size);
      P.panel(cx - tw / 2 - 12, V.y + V.h * 0.06, tw + 24, 28, 'teal', chip, 14);
      P.text(msg, cx, V.y + V.h * 0.06 + 14, 'teal', chip, size, 'center');
    }
    this.mark('campus', cx, cy);
  }
}
