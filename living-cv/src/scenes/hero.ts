import { Scene } from '../core/scene';
import { ease, hash, lerp, seg, vnoise } from '../core/math';
import { css, mix } from '../core/color';

/** A stack of live neural traces that collapses into one clean signal as you scroll. */
export class HeroScene extends Scene {
  draw(p: number, t: number): void {
    const { ctx, w, h } = this;
    const n = this.narrow ? 14 : 22, mid = Math.floor(n / 2);
    const conv = ease(seg(p, 0.08, 0.9));
    const span = w * 1.4;
    for (let i = 0; i < n; i++) {
      const base = lerp(h * 0.1, h * 0.9, (i + 0.5) / n);
      const y0 = lerp(base, h * 0.46, conv);
      const amp = lerp((h / n) * 0.42, i === mid ? h * 0.07 : h * 0.01, conv);
      ctx.beginPath();
      for (let x = 0; x <= w + 3; x += 3) {
        let v = Math.sin(x * 0.011 + t * 1.2 + i * 1.7) * 0.3 + vnoise(x * 0.025 - t * 2.4 + i * 13.1) * 0.45;
        for (let k = 0; k < 3; k++) {
          const pos = (((hash(i * 7 + k) * span - t * (70 + hash(i + k * 3) * 110)) % span) + span) % span - w * 0.2;
          const d = (x - pos) / 5;
          if (d > -6 && d < 6) v += Math.exp(-d * d) * 2.4 - Math.exp(-((d - 1.6) ** 2)) * 1.1;
        }
        const env = Math.pow(Math.sin((x / w) * Math.PI), 0.5);
        const y = y0 + v * amp * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const centre = 1 - Math.abs(i - mid) / mid;
      const a = lerp(0.18 + 0.5 * centre * centre, i === mid ? 0.95 : 0.05 * (1 - conv), conv);
      ctx.strokeStyle = css(mix('copper', 'teal', conv * (i === mid ? 1 : 0.3)), a);
      ctx.lineWidth = i === mid ? lerp(1.2, 2, conv) : 1;
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    // Keep the name readable over the traces.
    const g = ctx.createRadialGradient(w * 0.18, h * 0.7, 0, w * 0.18, h * 0.7, Math.max(w, h) * 0.58);
    g.addColorStop(0, css('ink', 0.9));
    g.addColorStop(1, css('ink', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
