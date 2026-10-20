import { Scene } from '../core/scene';
import { ease, frac, lerp, seg } from '../core/math';
import { css, mix, type Colour, type Hue } from '../core/color';
import { FIELD_STRIDE, FLAG_BAD, FLAG_BELOW, kernels, type FieldKernel } from '../kernel';

const THEMES: { name: string; hue: Hue; x: number; y: number; r: number }[] = [
  { name: 'Screen sharing', hue: 'teal', x: 0.12, y: 0.72, r: 1.0 },
  { name: 'Sign-in loops', hue: 'violet', x: 0.33, y: 0.84, r: 0.85 },
  { name: 'Search relevance', hue: 'sky', x: 0.53, y: 0.68, r: 1.2 },
  { name: 'Meeting recaps', hue: 'mint', x: 0.73, y: 0.85, r: 0.75 },
  { name: 'Sync conflicts', hue: 'amber', x: 0.9, y: 0.7, r: 0.9 },
];
const GLYPHS = ['#@!%', '&*$#!', '%$@&', '!!#%*', '@#$!'];
const HYPOTHESIS = 'Hypothesis: sign-in friction drives mobile drop-off';
const QUOTES = ['“It asks me to sign in again every single morning.”', '“Stuck bouncing between the app and the browser.”', '“Gave up and finished it on my phone.”'];

/** Feedback rains in, a safety layer redacts the unkind, and what remains forms grounded themes. */
export class VoiceScene extends Scene {
  /** Particle positions come from the Rust field kernel when available. */
  private readonly field: FieldKernel = kernels().field(1300);

  draw(p: number, t: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const mY = V.y + V.h * 0.36;
    const flow = 0.15 + 0.85 * ease(seg(p, 0, 0.14));
    const m = ease(seg(p, 0.2, 0.34));
    const k = ease(seg(p, 0.42, 0.62));
    const q = seg(p, 0.68, 0.92);
    const unit = Math.min(V.w, V.h) * (nar ? 0.09 : 0.075);
    const centres = THEMES.map((th) => ({ x: V.x + V.w * th.x, y: V.y + V.h * th.y, r: unit * th.r }));

    const count = Math.floor(1.0e6 + p * 1.6e6 + ((t * 977) % 1000));
    P.text('VERBATIMS INGESTED', V.x + 4, V.y + 10, 'grey', 0.8, 10);
    P.text(count.toLocaleString('en-US'), V.x + 4, V.y + 30, 'white', 0.95, 20);

    const n = Math.floor((nar ? 650 : this.field.length) * flow);
    centres.forEach((c, i) => this.field.setCentre(i, c.x, c.y, c.r));
    this.field.step({ t, x: V.x, y: V.y, w: V.w, h: V.h, membraneY: mY, membrane: m, cluster: k }, n);
    const out = this.field.out;
    for (let j = 0; j < n; j++) {
      const o = j * FIELD_STRIDE, x = out[o], y = out[o + 1], u = out[o + 2], flags = out[o + 3];
      const bad = (flags & FLAG_BAD) !== 0, below = (flags & FLAG_BELOW) !== 0, cl = flags >> 2;
      let c: Colour = bad ? (below ? 'grey' : 'red') : 'white';
      let a = below ? 0.45 : bad ? 0.85 : 0.4;
      if (u > 0) { c = mix(c, THEMES[cl].hue, u); a = lerp(a, 0.8, u); }
      if (bad && j % 5 === 0 && !(below && k > 0.3)) {
        if (below) { this.ctx.fillStyle = css('grey', 0.5); this.ctx.fillRect(x - 8, y - 2, 16, 4); }
        else P.text(GLYPHS[j % GLYPHS.length], x, y, 'red', 0.75, 10, 'center');
      } else {
        P.pixel(x, y, 2, c, a);
      }
    }

    if (m > 0) {
      const g = this.ctx.createLinearGradient(0, mY - 14, 0, mY + 14);
      g.addColorStop(0, css('teal', 0)); g.addColorStop(0.5, css('teal', 0.12 * m)); g.addColorStop(1, css('teal', 0));
      this.ctx.fillStyle = g; this.ctx.fillRect(V.x, mY - 14, V.w, 28);
      P.plot((u) => ({ x: V.x + u * V.w, y: mY + Math.sin(u * V.w * 0.05 + t * 3) * 2 }), 200, 'teal', 0.8 * m, 1.5);
      P.text('SAFETY LAYER · REDACT · DE-IDENTIFY', V.x + V.w - 4, mY - 16, 'teal', 0.9 * m, 10, 'right');
      this.mark('membrane', V.x + V.w * 0.6, mY);
    }

    if (k > 0.4) {
      const a = seg(k, 0.4, 1);
      THEMES.forEach((th, i) => P.text(th.name.toUpperCase(), centres[i].x, centres[i].y - centres[i].r - 12, th.hue, a, nar ? 9 : 11, 'center'));
    }

    if (q > 0) this.drawHypothesis(q, t, centres[1]);
  }

  /** A typed hypothesis beams onto its theme and pulls up the verbatims that support it. */
  private drawHypothesis(q: number, t: number, target: { x: number; y: number; r: number }): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const bx = nar ? V.x + 8 : V.x + V.w * 0.4, bw = nar ? V.w - 16 : V.w * 0.58, by = V.y + V.h * (nar ? 0.12 : 0.06);
    const typed = HYPOTHESIS.slice(0, Math.floor(HYPOTHESIS.length * seg(q, 0, 0.35)));
    P.panel(bx, by, bw, 38, 'copper', 1);
    P.text(typed + (q < 0.35 && frac(t * 2) < 0.5 ? '▍' : ''), bx + 12, by + 19, 'copper', 1, P.fit(HYPOTHESIS + '▍', bw - 24, 12));
    const beam = seg(q, 0.35, 0.5);
    if (beam > 0) {
      const sx = bx + bw * 0.2, sy = by + 38;
      P.line(sx, sy, lerp(sx, target.x, beam), lerp(sy, target.y, beam), 'violet', 0.8, 1, [3, 5], -t * 30);
      if (beam >= 1) { const f = frac(t * 0.8); P.ring(target.x, target.y, target.r + f * 30, 'violet', 1 - f); }
    }
    const card = ease(seg(q, 0.5, 0.7));
    if (card <= 0) return;
    const cw = nar ? V.w - 16 : Math.min(V.w * 0.56, 470), cx0 = nar ? V.x + 8 : V.x + V.w * 0.42, cy0 = V.y + V.h * (nar ? 0.4 : 0.42), ch = 108;
    this.ctx.globalAlpha = card;
    P.panel(cx0, cy0, cw, ch, 'violet', 1, 10);
    P.text('SUPPORTED · GROUNDED IN VERBATIMS', cx0 + 14, cy0 + 16, 'violet', 1, 10);
    const qs = P.fit(QUOTES[0], cw - 28, 12);
    QUOTES.forEach((qt, i) => P.text(qt, cx0 + 14, cy0 + 40 + i * 20, 'white', 0.9, qs));
    // A balanced sample: equal draws across platforms, not just the loudest voices.
    for (let i = 0; i < 5; i++) {
      const x = cx0 + cw - 14 - (4 - i) * (nar ? 26 : 32);
      this.ctx.fillStyle = css('violet', 0.6); this.ctx.fillRect(x - 4, cy0 + ch - 14, 8, 6 * card);
    }
    this.ctx.globalAlpha = 1;
  }
}
