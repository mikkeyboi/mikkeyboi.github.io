import { Scene } from '../core/scene';
import { TAU, clamp, ease, frac, hash, lerp, seg, vnoise } from '../core/math';
import { css, mix } from '../core/color';

const IDEAS = ['new model', 'reward fn', 'agent', 'prompt', 'RL policy', 'eval idea', 'LoRA', 'router'];
const DRILL_PERIOD = 9;

interface Spark { r: number[]; lane: number }

/**
 * The through-line: noisy research on the left, a production estate on the right
 * (SLO, paired regions, observability), and an evaluation gate that lets research across.
 */
export class BridgeScene extends Scene {
  private sparks: Spark[] = Array.from({ length: 460 }, (_, i) => ({
    r: [hash(i), hash(i + 0.31), hash(i + 0.67), hash(i * 3.3), hash(i * 5.1)],
    lane: i % 7,
  }));

  draw(p: number, t: number): void {
    const P = this.paint, V = this.box, nar = this.narrow;
    const prod = ease(seg(p, 0.2, 0.34));
    const obs = ease(seg(p, 0.46, 0.58));
    const gate = ease(seg(p, 0.66, 0.78));
    const admit = ease(seg(p, 0.7, 0.97));

    const cx = V.x + V.w * (nar ? 0.15 : 0.14), cy = V.y + V.h * 0.48;
    const gx = V.x + V.w * 0.36;
    const rx = V.x + V.w * (nar ? 0.74 : 0.73), rw = V.w * (nar ? 0.24 : 0.25);
    const regA = { y: V.y + V.h * 0.24, h: V.h * 0.2 }, regB = { y: V.y + V.h * 0.56, h: V.h * 0.2 };
    const lanes = 7, laneY = (l: number) => V.y + V.h * (0.32 + (0.36 * l) / (lanes - 1));

    // Business-continuity drill: the primary region steps aside, traffic fails over, the SLO holds.
    const cyc = frac(t / DRILL_PERIOD);
    const drill = prod > 0.6 ? ease(seg(cyc, 0.55, 0.6)) * (1 - ease(seg(cyc, 0.78, 0.83))) : 0;
    const target = (l: number) => {
      const reg = drill > 0.5 ? regB : regA;
      return reg.y + reg.h * (0.25 + (0.5 * l) / (lanes - 1));
    };

    // Production estate.
    if (prod > 0.01) {
      [regA, regB].forEach((reg, i) => {
        const down = i === 0 ? drill : 0;
        const edge = mix('teal', 'red', down);
        P.panel(rx, reg.y, rw, reg.h, edge, prod, 10);
        const label = i === 0 ? (down > 0.5 ? 'REGION A · DRILL' : 'REGION A · PRIMARY') : drill > 0.5 ? 'REGION B · SERVING' : 'REGION B · PAIRED';
        P.text(label, rx + 10, reg.y + 12, edge, 0.9 * prod, nar ? 8 : 10);
        // Rack lights.
        for (let k = 0; k < 12; k++) {
          const lx = rx + 12 + (k % 6) * ((rw - 24) / 5), ly = reg.y + reg.h * (k < 6 ? 0.5 : 0.75);
          const on = hash(k + Math.floor(t * 3) * 0.37 + i * 7) > 0.35;
          P.dot(lx, ly, 2, edge, prod * (on ? 0.9 : 0.25) * (1 - 0.6 * down));
        }
      });
      // Replication between regions.
      const mx = rx + rw * 0.5;
      P.line(mx, regA.y + regA.h, mx, regB.y, 'teal', 0.5 * prod, 1, [3, 4], -t * 18);
      P.text('REPLICATED · BCDR', mx + 8, (regA.y + regA.h + regB.y) / 2, 'teal', 0.75 * prod, nar ? 8 : 10);
      this.mark('regions', rx, regB.y + regB.h * 0.5);

      // SLO gauge.
      const sli = 99.97 - 0.03 * drill + vnoise(t * 0.7) * 0.005;
      const gxC = rx + rw * 0.5, gyC = V.y + V.h * 0.17, gr = Math.min(rw * 0.32, V.h * 0.09);
      const fillTo = clamp((sli - 99.0) / 1.0);
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = css('grey', 0.25 * prod); this.ctx.lineWidth = 4;
      this.ctx.beginPath(); this.ctx.arc(gxC, gyC, gr, Math.PI, TAU); this.ctx.stroke();
      this.ctx.strokeStyle = css('teal', 0.95 * prod);
      this.ctx.beginPath(); this.ctx.arc(gxC, gyC, gr, Math.PI, Math.PI + Math.PI * fillTo * prod); this.ctx.stroke();
      this.ctx.lineWidth = 1; this.ctx.lineCap = 'butt';
      const sloA = Math.PI + Math.PI * 0.9;
      P.line(gxC + Math.cos(sloA) * (gr - 7), gyC + Math.sin(sloA) * (gr - 7), gxC + Math.cos(sloA) * (gr + 7), gyC + Math.sin(sloA) * (gr + 7), 'white', 0.8 * prod, 1.5);
      P.text(`${sli.toFixed(2)}%`, gxC, gyC - 8, 'white', prod, nar ? 12 : 15, 'center');
      P.text('SLI · SLO 99.9%', gxC, gyC + 8, 'teal', 0.8 * prod, nar ? 8 : 9, 'center');
      this.mark('slo', gxC + gr, gyC - gr * 0.5);
    }

    // Lanes.
    for (let l = 0; l < lanes; l++) P.line(gx, laneY(l), rx - 30, laneY(l), 'teal', 0.06 + 0.12 * prod);

    // Observability: every request leaves a trace.
    const ox = lerp(gx, rx, 0.55);
    if (obs > 0.01) {
      P.line(ox, laneY(0) - 22, ox, laneY(lanes - 1) + 22, 'violet', 0.6 * obs, 1, [2, 4]);
      P.text('OBSERVE', ox, laneY(0) - 32, 'violet', 0.9 * obs, nar ? 8 : 10, 'center');
      const wx = gx + 8, ww = rx - gx - 40, wy = V.y + V.h * 0.8, wh = V.h * 0.17;
      P.panel(wx, wy, ww, wh, 'violet', obs, 8);
      P.text('TRACES · LATENCY · TOKENS · TOOL CALLS', wx + 10, wy + 11, 'violet', 0.9 * obs, nar ? 7 : 9);
      const rows = 5, rh = (wh - 26) / rows;
      for (let k = 0; k < rows; k++) {
        const tick = Math.floor(t * 0.45 + k * 0.37);
        const start = hash(tick * 3.1 + k) * 0.3 + k * 0.08, len = 0.12 + hash(tick * 7.7 + k) * 0.35;
        const age = frac(t * 0.45 + k * 0.37);
        const bx = wx + 10 + start * (ww - 20), bw = len * (ww - 20) * ease(clamp(age * 3));
        const c = k === 0 ? 'teal' : k % 2 ? 'violet' : 'sky';
        this.ctx.fillStyle = css(c, 0.7 * obs);
        this.ctx.fillRect(bx, wy + 22 + k * rh, Math.min(bw, wx + ww - 10 - bx), rh * 0.55);
      }
      this.mark('traces', wx + ww * 0.6, wy);
    }

    // Production traffic, always flowing once the estate exists.
    if (prod > 0.01) {
      for (let j = 0; j < 90; j++) {
        const l = j % lanes, u = frac(hash(j * 1.7) + t * (0.12 + hash(j) * 0.06));
        const x0 = gx + 6;
        const x = lerp(x0, rx + rw * 0.5, u);
        const yEnd = target(l);
        const y = x < rx - 30 ? laneY(l) : lerp(laneY(l), yEnd, ease(clamp((x - (rx - 30)) / (rw * 0.5 + 30))));
        P.pixel(x, y, 2, 'teal', 0.6 * prod * Math.sin(u * Math.PI));
        if (obs > 0.01 && Math.abs(x - ox) < 3) P.ring(x, y, 5, 'violet', 0.8 * obs);
      }
    }

    // Evaluation gate.
    if (gate > 0.01) {
      const gh = V.h * 0.25 * gate;
      P.ctx.strokeStyle = css('teal', 0.65 * gate);
      P.ctx.lineWidth = 1.5;
      P.ctx.beginPath(); P.ctx.ellipse(gx, cy, 16, gh, 0, 0, TAU); P.ctx.stroke(); P.ctx.lineWidth = 1;
      for (let k = 0; k < 16; k++) {
        const yy = cy + (k / 15 - 0.5) * gh * 1.8;
        P.line(gx - 24, yy, gx - 18, yy, 'teal', 0.3 * gate);
      }
      P.text('EVALUATION GATE', gx, cy - gh - 16, 'teal', 0.85 * gate, nar ? 8 : 11, 'center');
      this.mark('gate', gx + 16, cy - gh * 0.6);
    }

    // Research: noisy sparks, some admitted through the gate into the lanes.
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const n = nar ? 260 : this.sparks.length;
    for (let i = 0; i < n; i++) {
      const [r1, r2, r3, r4, r5] = this.sparks[i].r, ln = this.sparks[i].lane;
      const jx = Math.sin(t * 3.1 + r3 * 40) * 5, jy = Math.cos(t * 2.7 + r1 * 30) * 5;
      const chX = cx + (vnoise(t * 0.35 + r1 * 50) * 0.8 + (r3 - 0.5) * 0.6) * V.w * 0.18 + jx;
      const chY = cy + (vnoise(t * 0.31 + r2 * 80) * 0.75 + (r4 - 0.5) * 0.5) * V.h * 0.42 + jy;
      if (r4 < admit && gate > 0.5) {
        const sp = frac(r5 + t * 0.06 * (0.6 + r1));
        if (sp < 0.35) {
          const u = ease(sp / 0.35);
          P.dot(lerp(chX, gx, u), lerp(chY, laneY(ln), u), 1.6, mix('copper', 'teal', u), 0.8);
        } else {
          const v = (sp - 0.35) / 0.65, x = gx + v * (rx - gx + rw * 0.5);
          const y = x < rx - 30 ? laneY(ln) : lerp(laneY(ln), target(ln), ease(clamp((x - (rx - 30)) / (rw * 0.5 + 30))));
          P.line(x - 12, y, x, y, 'teal', 0.85 * (1 - v * 0.5), 2);
        }
      } else {
        P.dot(chX, chY, 1.2 + r5 * 1.6, 'copper', 0.35 + 0.5 * r2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    P.glow(cx, cy, V.w * 0.2, 'copper', 0.07);

    // Ideas drifting in the research cloud.
    IDEAS.forEach((s, i) => {
      const x = cx + vnoise(t * 0.12 + i * 9.1) * V.w * 0.13, y = cy + (i / IDEAS.length - 0.5) * V.h * 0.6 + vnoise(t * 0.1 + i * 3.3) * 14;
      P.text(s, x, y, 'copper', 0.45 + 0.25 * Math.sin(t + i), nar ? 8 : 10, 'center');
    });
    this.mark('research', cx, cy - V.h * 0.3);
  }
}
