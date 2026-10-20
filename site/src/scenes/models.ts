import { Scene } from '../core/scene';
import { ease, hash, lerp, seg, type Box, type Point } from '../core/math';
import { css, type Hue } from '../core/color';
import { el } from '../core/dom';
import { track } from '../core/analytics';

type Tier = 'full' | 'hedged' | 'refused';
const TIER_HUE: Record<Tier, Hue> = { full: 'teal', hedged: 'amber', refused: 'red' };
const TIER_LABEL: Record<Tier, string> = { full: 'FULL HELP', hedged: 'HEDGED', refused: 'REFUSED' };

/**
 * Benign requests that merely look risky, from the refusal-direction playground on the blog.
 * margin is each one's distance below the refusal threshold before any steering.
 */
const REQUESTS: { prompt: string; trigger: string; margin: number; full: string; hedged: string; refused: string }[] = [
  { prompt: 'How do I kill a frozen process on Linux?', trigger: 'kill', margin: -1.6, full: 'Run `kill <pid>`, or `kill -9 <pid>` if it ignores the first signal.', hedged: 'I can explain `kill` at a high level, if you mean an OS process.', refused: "I'd rather not get into killing things without more context." },
  { prompt: "What's the best way to get rid of weeds?", trigger: 'get rid of', margin: -1.25, full: 'Pull them after rain, mulch to block regrowth, spot-treat stubborn patches.', hedged: "I can suggest garden-safe approaches, but I'll keep it general.", refused: "I'm not comfortable advising on getting rid of things." },
  { prompt: 'How can I crack an egg with one hand?', trigger: 'crack', margin: -0.95, full: 'Tap it on a flat surface, then pull the shell apart with thumb and fingers.', hedged: 'I can walk through the basic motion; it takes practice.', refused: "I'd prefer not to give instructions on cracking things open." },
  { prompt: 'How do I whitelist an IP in my firewall?', trigger: 'whitelist', margin: -0.7, full: 'Add an allow rule for that address ahead of your default-deny, then reload.', hedged: "I can describe allow rules, if you administer this firewall.", refused: "I can't help change firewall access rules without more context." },
  { prompt: 'Which household items can I combine for a cleaner?', trigger: 'combine', margin: -0.45, full: 'Warm water with dish soap; diluted vinegar for mineral spots. Never mix bleach.', hedged: "I'll suggest single-ingredient cleaners, but not combinations.", refused: "I'd rather not advise on combining household chemicals." },
];

const tierOf = (m: number): Tier => (m > 0 ? 'refused' : m > -0.75 ? 'hedged' : 'full');

/** A norm-matched random direction: same size of push, nearly orthogonal to refusal. */
const RANDOM_COS = 0.08;
const DOSE_MIN = -2, DOSE_MAX = 2.5;

interface Pt { x: number; y: number; harmful: boolean }

/**
 * Interpretability as intuition: activations as points, refusal as one direction through them,
 * and a slider that pushes benign requests along it (or along a random control that does nothing).
 */
export class ModelsScene extends Scene {
  private readonly points: Pt[];
  private readonly rHat: Point;
  private readonly theta: number;
  private readonly root = el('div', 'model-controls');
  private readonly slider = el('input');
  private readonly doseOut = el('output');
  private readonly dirButtons: HTMLButtonElement[];
  private touched = false;
  private random = false;

  constructor(ctx: CanvasRenderingContext2D) {
    super(ctx);
    const gauss = (i: number) => Math.sqrt(-2 * Math.log(hash(i) + 1e-9)) * Math.cos(6.283 * hash(i + 0.5));
    this.points = Array.from({ length: 130 }, (_, i) => {
      const harmful = i < 50;
      const [cx, cy, sd] = harmful ? [1.6, 0.55, 0.45] : [-1.2, -0.35, 0.55];
      return { x: cx + gauss(i * 2.3) * sd, y: cy + gauss(i * 5.7 + 1) * sd * 0.8, harmful };
    });
    const mean = (h: boolean) => {
      const s = this.points.filter((q) => q.harmful === h);
      return { x: s.reduce((a, q) => a + q.x, 0) / s.length, y: s.reduce((a, q) => a + q.y, 0) / s.length };
    };
    const mh = mean(true), mb = mean(false), d = Math.hypot(mh.x - mb.x, mh.y - mb.y);
    this.rHat = { x: (mh.x - mb.x) / d, y: (mh.y - mb.y) / d };
    const proj = (q: Point) => q.x * this.rHat.x + q.y * this.rHat.y;
    this.theta = lerp(proj(mb), proj(mh), 0.62);

    // Controls: a dose slider and a direction toggle.
    this.slider.type = 'range';
    this.slider.min = String(DOSE_MIN);
    this.slider.max = String(DOSE_MAX);
    this.slider.step = '0.05';
    this.slider.value = '0';
    this.slider.setAttribute('aria-label', 'Steering dose along the chosen direction');
    this.slider.addEventListener('input', () => { this.touched = true; });
    this.slider.addEventListener('change', () => track('refusal_slider', { dose: Math.round(parseFloat(this.slider.value) * 10) / 10, direction: this.random ? 'random' : 'refusal' }));
    const label = el('label', 'mc-label', 'Push along ');
    this.dirButtons = (['refusal direction', 'random control'] as const).map((name, i) => {
      const b = el('button', i === 0 ? 'on' : '', name);
      b.type = 'button';
      b.addEventListener('click', () => {
        this.random = i === 1;
        this.touched = true;
        this.dirButtons.forEach((x, j) => x.classList.toggle('on', j === i));
        track('refusal_direction_toggle', { direction: i === 1 ? 'random' : 'refusal' });
      });
      return b;
    });
    const dirs = el('div', 'mc-dirs');
    dirs.append(...this.dirButtons);
    label.append(dirs);
    const row = el('div', 'mc-row');
    row.append(el('span', '', 'remove'), this.slider, el('span', '', 'add'), this.doseOut);
    this.root.append(label, row);
  }

  controls(): HTMLElement {
    return this.root;
  }

  private get plot(): Box {
    const V = this.box;
    return this.narrow ? { x: V.x + 12, y: V.y + 8, w: V.w - 24, h: V.h * 0.46 } : { x: V.x, y: V.y + V.h * 0.06, w: V.w * 0.52, h: V.h * 0.86 };
  }

  private get panel(): Box {
    const V = this.box;
    return this.narrow ? { x: V.x + 12, y: V.y + V.h * 0.5, w: V.w - 24, h: V.h * 0.5 } : { x: V.x + V.w * 0.56, y: V.y + V.h * 0.06, w: V.w * 0.44, h: V.h * 0.88 };
  }

  draw(p: number): void {
    const P = this.paint, B = this.plot;
    const cloud = ease(seg(p, -0.1, 0.08));
    const axis = ease(seg(p, 0.19, 0.28));
    const why = ease(seg(p, 0.36, 0.42)) * (1 - ease(seg(p, 0.5, 0.54)));
    const play = ease(seg(p, 0.5, 0.55));
    const control = ease(seg(p, 0.78, 0.84));

    // Scroll suggests a dose until the reader takes the slider.
    if (!this.touched) {
      const auto = p < 0.64 ? lerp(0, 2.2, ease(seg(p, 0.53, 0.62)))
        : p < 0.76 ? lerp(2.2, -1.6, ease(seg(p, 0.65, 0.73)))
        : lerp(-1.6, 2.2, ease(seg(p, 0.8, 0.88)));
      this.slider.value = String(auto);
    }
    const dose = parseFloat(this.slider.value);
    this.doseOut.textContent = `${dose >= 0 ? '+' : ''}${dose.toFixed(1)}`;
    if (p < 0.48 && this.touched) this.touched = false;
    if (control > 0.5 && !this.random && !this.touched) this.setRandom(true);
    if (control < 0.5 && this.random && !this.touched) this.setRandom(false);
    this.positionControls(play);

    const dir = this.random ? { x: -this.rHat.y * Math.sqrt(1 - RANDOM_COS ** 2) + this.rHat.x * RANDOM_COS, y: this.rHat.x * Math.sqrt(1 - RANDOM_COS ** 2) + this.rHat.y * RANDOM_COS } : this.rHat;
    const along = this.random ? RANDOM_COS : 1;

    // Activation space, centred and scaled to the plot box.
    const sc = Math.min(B.w / 5.4, B.h / 3.8), ox = B.x + B.w / 2 - 0.2 * Math.min(B.w / 5.4, B.h / 3.8), oy = B.y + B.h / 2;
    const S = (q: Point) => ({ x: ox + q.x * sc, y: oy - q.y * sc });
    P.text('ACTIVATIONS AT ONE LAYER · 2D VIEW', B.x, B.y - 4, 'grey', 0.7 * cloud, this.narrow ? 8 : 10);

    // Threshold θ: perpendicular to the refusal direction.
    const perp = { x: -this.rHat.y, y: this.rHat.x };
    const tc = { x: this.rHat.x * this.theta, y: this.rHat.y * this.theta };
    if (axis > 0.01) {
      const a = S({ x: tc.x + perp.x * 2.2, y: tc.y + perp.y * 2.2 }), b = S({ x: tc.x - perp.x * 2.2, y: tc.y - perp.y * 2.2 });
      P.line(a.x, a.y, b.x, b.y, 'red', 0.55 * axis, 1, [4, 4]);
      P.text('θ  REFUSE →', a.x + 6, a.y + 8, 'red', 0.8 * axis, 10);
    }

    const shift = { x: dir.x * dose * play, y: dir.y * dose * play };
    for (const q of this.points) {
      const moved = q.harmful ? q : { x: q.x + shift.x, y: q.y + shift.y };
      const s = S(moved);
      const refuses = moved.x * this.rHat.x + moved.y * this.rHat.y > this.theta;
      P.dot(s.x, s.y, 2.2, q.harmful ? 'red' : refuses ? 'amber' : 'teal', (q.harmful ? 0.45 : 0.75) * cloud);
    }
    if (cloud > 0.3) {
      const hl = S({ x: 1.6, y: 1.35 }), bl = S({ x: -1.2, y: -1.35 });
      P.text('HARMFUL PROMPTS', hl.x, hl.y, 'red', 0.7 * cloud, 9, 'center');
      P.text('BENIGN PROMPTS', bl.x, bl.y, 'teal', 0.8 * cloud, 9, 'center');
    }

    // The refusal direction: difference of means, harmless → harmful.
    if (axis > 0.01) {
      const mb = S({ x: -1.2, y: -0.35 }), mh = S({ x: -1.2 + this.rHat.x * 2.95 * axis, y: -0.35 + this.rHat.y * 2.95 * axis });
      P.arrow(mb.x, mb.y, mh.x, mh.y, 'copper', axis, 2.5);
      P.text('REFUSAL DIRECTION', (mb.x + mh.x) / 2 + 8, (mb.y + mh.y) / 2 - 12, 'copper', axis, 10);
      this.mark('direction', (mb.x + mh.x) / 2, (mb.y + mh.y) / 2);
    }
    if (play > 0.01 && this.random) {
      const c0 = S({ x: -1.2, y: -0.35 }), c1 = S({ x: -1.2 + dir.x * 2.2, y: -0.35 + dir.y * 2.2 });
      P.arrow(c0.x, c0.y, c1.x, c1.y, 'grey', play, 2);
      P.text('RANDOM, SAME NORM', c1.x + 6, c1.y, 'grey', play, 9);
    }

    // The five benign requests, as labelled points and as a response panel.
    const margins = REQUESTS.map((r) => r.margin + dose * along * play);
    REQUESTS.forEach((r, i) => {
      const base = { x: tc.x + this.rHat.x * r.margin + perp.x * (i - 2) * 0.32, y: tc.y + this.rHat.y * r.margin + perp.y * (i - 2) * 0.32 };
      const s = S({ x: base.x + shift.x, y: base.y + shift.y });
      const tier = tierOf(margins[i]);
      P.ring(s.x, s.y, 7, TIER_HUE[tier], 0.95 * axis);
      P.text(String(i + 1), s.x, s.y, 'white', axis, 9, 'center');
      if (why > 0.01) {
        // How far each request sits from refusing, measured along the refusal direction.
        const edge = S({ x: base.x - this.rHat.x * r.margin, y: base.y - this.rHat.y * r.margin });
        P.line(s.x, s.y, edge.x, edge.y, 'amber', 0.7 * why, 1, [2, 3]);
        P.text(`“${r.trigger}”`, s.x - 10, s.y - 2, 'red', why, this.narrow ? 8 : 10, 'right');
      }
    });
    const panelA = Math.max(why, play);
    if (panelA > 0.01) this.drawPanel(margins, panelA, control, dose, why);
  }

  /** A line of prompt text with its look-alike trigger word picked out in red. */
  private highlighted(line: string, trigger: string, x: number, y: number, size: number, a: number, why: number): void {
    const P = this.paint, i = line.toLowerCase().indexOf(trigger);
    if (i < 0 || why <= 0.01) { P.text(line, x, y, 'white', 0.92 * a, size); return; }
    const pre = line.slice(0, i), word = line.slice(i, i + trigger.length), post = line.slice(i + trigger.length);
    const w0 = P.measure(pre, size), w1 = P.measure(word, size);
    P.text(pre, x, y, 'white', 0.92 * a, size);
    P.text(word, x + w0, y, 'red', a, size);
    P.line(x + w0, y + size * 0.65, x + w0 + w1, y + size * 0.65, 'red', why * a, 1.2);
    P.text(post, x + w0 + w1, y, 'white', 0.92 * a, size);
  }

  private setRandom(on: boolean): void {
    this.random = on;
    this.dirButtons.forEach((b, j) => b.classList.toggle('on', j === (on ? 1 : 0)));
  }

  private positionControls(a: number): void {
    const Pn = this.panel;
    this.root.classList.toggle('on', a > 0.5);
    this.root.style.width = `${Math.round(Pn.w)}px`;
    this.root.style.transform = `translate(${Math.round(Pn.x)}px, ${Math.round(Pn.y)}px)`;
  }

  private drawPanel(margins: number[], a: number, control: number, dose: number, why: number): void {
    const P = this.paint, Pn = this.panel, nar = this.narrow;
    let y = Pn.y + (nar ? 70 : 84);
    const size = nar ? 10 : 12;
    REQUESTS.forEach((r, i) => {
      const tier = tierOf(margins[i]);
      P.text(`${i + 1}`, Pn.x, y + 6, 'grey', 0.8 * a, size);
      const badge = TIER_LABEL[tier], bw = P.measure(badge, 9) + 14;
      P.roundRect(Pn.x + Pn.w - bw, y - 2, bw, 16, 8);
      this.ctx.fillStyle = css(TIER_HUE[tier], 0.18 * a); this.ctx.fill();
      P.text(badge, Pn.x + Pn.w - bw / 2, y + 6, TIER_HUE[tier], a, 9, 'center');
      const promptLines = P.wrap(r.prompt, Pn.w - bw - 32, size);
      promptLines.forEach((l, j) => this.highlighted(l, r.trigger, Pn.x + 18, y + 6 + j * size * 1.35, size, a, why));
      y += promptLines.length * size * 1.35 + 4;
      if (!nar) {
        const reply = P.wrap(r[tier], Pn.w - 18, size - 1);
        reply.forEach((l, j) => P.text(l, Pn.x + 18, y + 6 + j * (size - 1) * 1.35, TIER_HUE[tier], 0.7 * a, size - 1));
        y += reply.length * (size - 1) * 1.35 + 14;
      } else y += 6;
    });
    // Refusal rate across all benign prompts, under the current push.
    const benign = this.points.filter((q) => !q.harmful);
    const along = this.random ? RANDOM_COS : 1;
    const rate = (dd: number) => benign.filter((q) => q.x * this.rHat.x + q.y * this.rHat.y + dd * along > this.theta).length / benign.length;
    const before = rate(0), after = rate(dose * a);
    y += 6;
    P.text('REFUSAL RATE · BENIGN PROMPTS', Pn.x, y, 'grey', 0.8 * a, 9);
    P.text(`${before.toFixed(2)} → ${after.toFixed(2)}`, Pn.x + Pn.w, y, after > before + 0.05 ? 'red' : 'teal', a, 11, 'right');
    P.line(Pn.x, y + 12, Pn.x + Pn.w, y + 12, 'grey', 0.25 * a, 4);
    P.line(Pn.x, y + 12, Pn.x + Pn.w * after, y + 12, this.random ? 'grey' : 'copper', 0.9 * a, 4);
    if (control > 0.01) P.text(this.random ? 'SAME-SIZE RANDOM PUSH: BEHAVIOUR BARELY MOVES' : 'THE REFUSAL DIRECTION MOVES BEHAVIOUR', Pn.x, y + 30, this.random ? 'grey' : 'copper', control * a, 9);
    this.mark('panel', Pn.x, Pn.y + 40);
    this.mark('rate', Pn.x + Pn.w * 0.5, y);
  }
}
