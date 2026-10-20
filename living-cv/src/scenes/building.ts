import { Scene } from '../core/scene';
import { TAU, clamp, ease, frac, hash, lerp, seg, type Point } from '../core/math';
import { IsoBuilding } from './shared/iso';

const AGENTS = ['Fault detection', 'Diagnostics', 'Work orders', 'Operator copilot', 'Technician'];
const ALARM_SENSOR = 9;
const ALARM = 'AHU-3 · SUPPLY AIR HIGH';

/** A building assembles, telemetry pours out of it, and an agent mesh works the alarm that matters. */
export class BuildingScene extends Scene {
  private building = new IsoBuilding({ x: 0, y: 0 }, 1);
  private mesh: Point = { x: 0, y: 0 };
  private meshR = 0;

  protected layout(): void {
    const V = this.box, nar = this.narrow;
    this.building.scale = Math.min(V.w, V.h) * (nar ? 0.06 : 0.056);
    this.building.origin = { x: V.x + V.w * (nar ? 0.3 : 0.27), y: V.y + V.h * 0.86 };
    this.mesh = { x: V.x + V.w * (nar ? 0.72 : 0.74), y: V.y + V.h * (nar ? 0.48 : 0.44) };
    this.meshR = Math.min(V.w * (nar ? 0.16 : 0.18), V.h * 0.28);
  }

  draw(p: number, t: number): void {
    const P = this.paint, nar = this.narrow;
    const built = seg(p, 0.02, 0.24) * this.building.floors;
    const flow = ease(seg(p, 0.22, 0.42));
    const alarm = seg(p, 0.32, 0.38);
    const mesh = ease(seg(p, 0.5, 0.64));
    const resolved = ease(seg(p, 0.86, 0.94));

    const sensors = this.building.draw(P, built);
    for (const s of sensors) {
      const isAlarm = s.id === ALARM_SENSOR && alarm > 0 && resolved < 1;
      const pulse = 0.5 + 0.5 * Math.sin(t * (isAlarm ? 8 : 2) + s.id);
      P.dot(s.pos.x, s.pos.y, isAlarm ? 3.5 : 2, isAlarm ? 'red' : 'teal', 0.6 + 0.4 * pulse);
      if (isAlarm) P.glow(s.pos.x, s.pos.y, 18 + 6 * pulse, 'red', 0.35 * alarm * (1 - resolved));
    }
    const alarmPos = sensors.find((s) => s.id === ALARM_SENSOR)?.pos;
    if (alarmPos && alarm > 0) {
      const la = 0.9 * alarm * (1 - seg(p, 0.6, 0.66));
      if (la > 0.01) {
        const tw = P.measure(ALARM, 10), ly = alarmPos.y - 24;
        P.roundRect(alarmPos.x - tw / 2 - 6, ly - 9, tw + 12, 18, 4);
        this.ctx.fillStyle = `rgba(4,6,11,${la})`; this.ctx.fill();
        this.ctx.strokeStyle = `rgba(255,77,109,${0.6 * la})`; this.ctx.stroke();
        P.text(ALARM, alarmPos.x, ly, 'red', la, 10, 'center');
      }
      this.mark('alarm', alarmPos.x, alarmPos.y);
    }

    if (flow > 0) {
      const lift = this.building.project(0, 0, this.building.floors + 3.2);
      const count = Math.floor(160 * flow);
      for (let j = 0; j < count && sensors.length; j++) {
        const s = sensors[Math.floor(hash(j * 3.7) * sensors.length)];
        const u = frac(hash(j) + t * (0.12 + hash(j * 1.3) * 0.12));
        const c1 = { x: lift.x + (hash(j * 5.3) - 0.5) * 60, y: lift.y };
        const x = (1 - u) ** 2 * s.pos.x + 2 * (1 - u) * u * c1.x + u * u * this.mesh.x;
        const y = (1 - u) ** 2 * s.pos.y + 2 * (1 - u) * u * c1.y + u * u * this.mesh.y;
        const red = s.id === ALARM_SENSOR && alarm > 0 && resolved < 1;
        P.pixel(x, y, red ? 3 : 2, red ? 'red' : 'teal', (red ? 0.9 : 0.55) * Math.sin(u * Math.PI));
      }
      this.mark('telemetry', lift.x, lift.y);
    }

    if (mesh > 0.01) this.drawMesh(mesh, resolved, t, nar);
  }

  /** Router plus specialist agents; the alarm walks its route and lights each agent it visits. */
  private drawMesh(a: number, resolved: number, t: number, nar: boolean): void {
    const P = this.paint, M = this.mesh, R = this.meshR;
    const pos = AGENTS.map((_, i) => {
      const ang = -Math.PI / 2 + (i * TAU) / AGENTS.length;
      return { x: M.x + Math.cos(ang) * R, y: M.y + Math.sin(ang) * R };
    });
    pos.forEach((q, i) => {
      P.line(M.x, M.y, q.x, q.y, 'teal', 0.18 * a);
      const n = pos[(i + 1) % pos.length];
      P.line(q.x, q.y, n.x, n.y, 'teal', 0.18 * a);
    });
    const route = [M, pos[0], pos[1], pos[2], pos[4]];
    const u = frac(t * 0.3) * (route.length - 1), si = Math.floor(u), sf = ease(u - si);
    const ax = lerp(route[si].x, route[si + 1].x, sf), ay = lerp(route[si].y, route[si + 1].y, sf);
    const c = this.ctx, hue = resolved > 0.5 ? 'teal' : 'red';
    c.strokeStyle = hue === 'red' ? `rgba(255,77,109,${0.6 * a})` : `rgba(57,225,198,${0.6 * a})`;
    c.lineWidth = 2; c.beginPath(); c.moveTo(route[0].x, route[0].y);
    for (let r = 1; r <= si; r++) c.lineTo(route[r].x, route[r].y);
    c.lineTo(ax, ay); c.stroke(); c.lineWidth = 1;
    P.glow(ax, ay, 14, hue, 0.8 * a); P.dot(ax, ay, 3, hue, a);
    P.dot(M.x, M.y, 7, 'teal', a); P.glow(M.x, M.y, 26, 'teal', 0.3 * a);
    P.text('ROUTER', M.x, M.y + 18, 'teal', a, nar ? 9 : 10, 'center');
    pos.forEach((q, i) => {
      const visited = [0, 1, 2, 4].includes(i) && route.indexOf(pos[i]) <= si;
      P.dot(q.x, q.y, 5, visited ? 'white' : 'teal', a);
      P.text(AGENTS[i].toUpperCase(), q.x, q.y + (q.y < M.y ? -14 : 16), visited ? 'white' : 'teal', 0.9 * a, nar ? 8 : 10, 'center');
    });
    this.mark('mesh', pos[1].x, pos[1].y);
    if (resolved > 0) {
      const msg = 'WORK ORDER RAISED · TECHNICIAN EN ROUTE', size = nar ? 9 : 11;
      const tw = P.measure(msg, size), bx = clamp(M.x - tw / 2 - 10, 8, this.w - tw - 28), by = M.y + R + 34;
      P.panel(bx, by, tw + 20, 26, 'teal', resolved, 13);
      P.text(msg, bx + 10, by + 13, 'teal', resolved, size);
    }
  }
}
