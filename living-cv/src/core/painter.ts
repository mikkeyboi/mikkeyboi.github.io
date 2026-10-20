import { clamp, TAU, type Point } from './math';
import { css, type Colour } from './color';

export const MONO = '"Ubuntu Mono", ui-monospace, monospace';

type Align = CanvasTextAlign;

/** Thin drawing vocabulary over a 2D context so scenes read as intent, not canvas calls. */
export class Painter {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  text(s: string, x: number, y: number, c: Colour, a = 1, size = 11, align: Align = 'left'): void {
    const { ctx } = this;
    ctx.font = `${size}px ${MONO}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(c, a);
    ctx.fillText(s, x, y);
  }

  /** Largest font size (up to max) at which s fits in width. */
  fit(s: string, width: number, max: number): number {
    const { ctx } = this;
    let size = max;
    ctx.font = `${size}px ${MONO}`;
    while (size > 8 && ctx.measureText(s).width > width) {
      size -= 0.5;
      ctx.font = `${size}px ${MONO}`;
    }
    return size;
  }

  /** Greedy word wrap to lines no wider than width at the given size. */
  wrap(s: string, width: number, size: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const w of s.split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (this.measure(next, size) > width && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  measure(s: string, size: number): number {
    this.ctx.font = `${size}px ${MONO}`;
    return this.ctx.measureText(s).width;
  }

  dot(x: number, y: number, r: number, c: Colour, a: number): void {
    const { ctx } = this;
    ctx.fillStyle = css(c, a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  pixel(x: number, y: number, size: number, c: Colour, a: number): void {
    this.ctx.fillStyle = css(c, a);
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }

  glow(x: number, y: number, r: number, c: Colour, a: number): void {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(c, a));
    g.addColorStop(1, css(c, 0));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Colour, a: number, width = 1, dash?: number[], dashOffset = 0): void {
    const { ctx } = this;
    ctx.save();
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOffset; }
    ctx.strokeStyle = css(c, a);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  ring(x: number, y: number, r: number, c: Colour, a: number, width = 1): void {
    const { ctx } = this;
    ctx.strokeStyle = css(c, a);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  arrow(x0: number, y0: number, x1: number, y1: number, c: Colour, a: number, width = 2): void {
    const { ctx } = this;
    this.line(x0, y0, x1, y1, c, a, width);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.fillStyle = css(c, a);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    const rr = clamp(r, 0, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** A filled, outlined panel: the recurring "HUD card" look. */
  panel(x: number, y: number, w: number, h: number, edge: Colour, a = 1, r = 8): void {
    const { ctx } = this;
    this.roundRect(x, y, w, h, r);
    ctx.fillStyle = css('ink', 0.92 * a);
    ctx.fill();
    ctx.strokeStyle = css(edge, 0.65 * a);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Catmull-Rom spline through points, as cubic Béziers on the current path. */
  smooth(pts: Point[], closed = false): void {
    const { ctx } = this, n = pts.length;
    const P = (i: number): Point => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
    }
  }

  /** Stroke a polyline sampled from fn over [0, 1]. */
  plot(fn: (u: number) => Point, steps: number, c: Colour, a: number, width = 1, upto = 1): void {
    const { ctx } = this;
    ctx.beginPath();
    const n = Math.max(1, Math.floor(steps * clamp(upto)));
    for (let i = 0; i <= n; i++) {
      const p = fn(i / steps);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = css(c, a);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}
