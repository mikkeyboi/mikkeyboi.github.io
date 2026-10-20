import { clamp, hash, type Point } from '../../core/math';
import type { Painter } from '../../core/painter';
import { css, type Hue } from '../../core/color';

export interface Sensor { id: number; floor: number; pos: Point }

/** An isometric glass building: floors that assemble bottom-up, with sensors on every floor. */
export class IsoBuilding {
  static readonly HALF_X = 2;
  static readonly HALF_Y = 1.5;

  constructor(public origin: Point, public scale: number, public floors = 6) {}

  project(x: number, y: number, z: number): Point {
    const { origin: o, scale: s } = this;
    return { x: o.x + (x - y) * 0.866 * s, y: o.y + (x + y) * 0.5 * s - z * s };
  }

  /** built counts floors (fractional while assembling); returns visible sensors. */
  draw(P: Painter, built: number, hue: Hue = 'teal', alpha = 1, sensorsPerFloor = 4): Sensor[] {
    const X = IsoBuilding.HALF_X, Y = IsoBuilding.HALF_Y, F = this.floors, ctx = P.ctx;
    const corners: [number, number][] = [[-X, -Y], [X, -Y], [X, Y], [-X, Y]];
    for (let f = 0; f <= F; f++) {
      const a = clamp(built - f + 1) * alpha;
      if (a <= 0) continue;
      ctx.beginPath();
      corners.forEach(([x, y], i) => { const q = this.project(x, y, f); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.closePath();
      ctx.fillStyle = css(hue, 0.035 * a); ctx.fill();
      ctx.strokeStyle = css(hue, (f === 0 || f === F ? 0.6 : 0.3) * a); ctx.stroke();
    }
    const top = Math.min(built, F);
    corners.forEach(([x, y]) => { const a = this.project(x, y, 0), b = this.project(x, y, top); P.line(a.x, a.y, b.x, b.y, hue, 0.45 * alpha); });
    const sensors: Sensor[] = [];
    for (let f = 0; f < F; f++) {
      if (built - f - 0.5 <= 0) continue;
      for (let j = 0; j < sensorsPerFloor; j++) {
        const id = f * sensorsPerFloor + j;
        const x = -X + 0.4 + hash(id * 1.7) * (2 * X - 0.8), y = -Y + 0.3 + hash(id * 2.9) * (2 * Y - 0.6);
        sensors.push({ id, floor: f, pos: this.project(x, y, f + 0.04) });
      }
    }
    return sensors;
  }

  /** Top of the roof, centred. */
  get roof(): Point {
    return this.project(0, 0, this.floors);
  }
}
