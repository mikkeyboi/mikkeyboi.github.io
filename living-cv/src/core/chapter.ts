import { clamp, lerp, type Point } from './math';
import { css } from './color';
import type { Scene } from './scene';
import type { Beat, ChapterContent, Era, Note } from '../content/types';
import { el } from './dom';
import { Painter } from './painter';
import { track, trackOnce } from './analytics';

export type SceneCtor = new (ctx: CanvasRenderingContext2D) => Scene;

interface BeatView { data: Beat; el: HTMLElement; step: HTMLElement }
interface NoteView { data: Note; el: HTMLElement; fade: number }

/** Note width on wide screens: narrower on small desktops so notes fit beside the visual. */
const noteWidth = (w: number) => Math.round(Math.min(280, Math.max(220, w * 0.2)));

/** The career axis the era timelines share. */
const AXIS_FROM = 2017, AXIS_TO = 2027;
/** Time runs this much faster while the pointer is over the visual. */
const HOVER_SPEED = 3;

/**
 * A scroll-pinned chapter: a tall section with a sticky stage holding the scene canvas,
 * the caption beats, notes pinned to the visual, and a hint for what comes next.
 */
export class Chapter {
  readonly el: HTMLElement;
  readonly stage: HTMLElement;
  readonly scene: Scene;
  visible = false;
  /** Smoothed and raw scroll progress through the chapter. */
  p = 0;
  target = 0;

  protected readonly canvas: HTMLCanvasElement;
  protected readonly ctx: CanvasRenderingContext2D;
  protected dpr = 1;
  private readonly paint: Painter;
  private beats: BeatView[] = [];
  private notes: NoteView[] = [];
  private hint?: HTMLElement;
  private active = -1;
  private started = false;
  /** Scene clock: wall time scaled by a speed that rises while the visual is hovered. */
  private clock = 0;
  private lastT = 0;
  private speed = 1;
  private hovering = false;
  private speedChip?: HTMLElement;
  private era?: HTMLElement;

  constructor(readonly content: ChapterContent, SceneClass: SceneCtor, protected nextTitle?: string) {
    this.el = el('section', 'scene');
    this.el.id = content.id;
    this.el.style.height = `${content.length * 100}vh`;
    this.stage = el('div', 'stage');
    this.canvas = el('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    this.scene = new SceneClass(this.ctx);
    this.paint = new Painter(this.ctx);
    this.stage.append(this.canvas);
    this.el.append(this.stage);
    this.buildCopy();
    this.buildNotes();
    this.buildLegend();
    if (content.era) this.buildEra(content.era);
    const controls = this.scene.controls();
    if (controls) this.stage.append(controls);
    this.watchHover();
  }

  /** A soft-focus career timeline: where this work sits in the arc, without competing with it. */
  private buildEra(era: Era): void {
    const box = el('div', 'era');
    const span = `${era.start}–${era.end ?? 'present'}`;
    box.setAttribute('aria-label', `${era.role}, ${era.org}, ${span}`);
    box.append(el('div', 'era-ghost', era.end ? `${era.start}–${String(era.end).slice(2)}` : `${era.start}–`));
    const axis = el('div', 'era-axis');
    const left = (era.start - AXIS_FROM) / (AXIS_TO - AXIS_FROM);
    const right = ((era.end ?? AXIS_TO - 1) + 1 - AXIS_FROM) / (AXIS_TO - AXIS_FROM);
    const bar = el('i');
    bar.style.left = `${left * 100}%`;
    bar.style.width = `${(right - left) * 100}%`;
    axis.append(bar);
    for (let y = AXIS_FROM; y < AXIS_TO; y++) {
      const label = y === era.start ? String(y) : y === (era.end ?? AXIS_TO - 1) + 1 && era.end ? String(era.end) : '';
      const tick = el('b', '', label);
      tick.style.left = `${((y - AXIS_FROM) / (AXIS_TO - AXIS_FROM)) * 100}%`;
      axis.append(tick);
    }
    if (!era.end) {
      const now = el('b', 'now', 'now');
      now.style.left = '100%';
      axis.append(now);
    }
    this.era = box;
    box.append(axis, el('p', 'era-role', `${era.role} · ${era.org} · ${span}`));
    this.stage.append(box);
  }

  /** Hovering the visual speeds its clock up; the chip says so. */
  private watchHover(): void {
    if (this.content.speedHint) {
      this.speedChip = el('div', 'speed-chip', 'Hover to speed up');
      this.speedChip.setAttribute('aria-hidden', 'true');
      this.stage.append(this.speedChip);
    }
    this.stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = this.stage.getBoundingClientRect(), b = this.scene.box;
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.hovering = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      if (this.hovering) trackOnce(`speed:${this.content.id}`, 'speed_hover', { chapter: this.content.id });
    });
    this.stage.addEventListener('pointerleave', () => { this.hovering = false; });
  }

  /** Caption column. Subclasses with bespoke copy (the hero) override this. */
  protected buildCopy(): void {
    const { beats } = this.content;
    if (!beats.length) return;
    const captions = el('div', 'captions');
    const steps = el('div', 'steps');
    steps.setAttribute('aria-hidden', 'true');
    this.beats = beats.map((data) => {
      const node = el('div', 'beat');
      if (data.kicker) node.append(el('p', 'kicker', data.kicker));
      node.append(el('h2', '', data.title));
      data.body?.forEach((b) => node.append(el('p', '', b)));
      if (data.stat) {
        const stat = el('p', 'stat');
        stat.append(el('b', '', data.stat.value), document.createTextNode(` ${data.stat.label}`));
        node.append(stat);
      }
      if (data.link) {
        const a = el('a', 'beat-link', `${data.link.label} →`);
        a.href = data.link.url;
        a.addEventListener('click', () => track('beat_link_click', { chapter: this.content.id, label: data.link!.label }));
        const line = el('p');
        line.append(a);
        node.append(line);
      }
      captions.append(node);
      const step = el('i');
      step.append(el('b'));
      steps.append(step);
      return { data, el: node, step };
    });
    this.hint = el('div', 'hint');
    captions.append(steps, this.hint);
    this.stage.append(captions);
  }

  private buildNotes(): void {
    const notes = this.content.notes ?? [];
    if (!notes.length) return;
    const layer = el('div', 'notes');
    this.notes = notes.map((data) => {
      const node = el('aside', 'note');
      // On phones a note collapses to a chip; tapping it reveals the detail.
      const more = el('button', 'note-more', 'Detail');
      more.type = 'button';
      more.addEventListener('click', () => {
        node.classList.toggle('open');
        trackOnce(`note-open:${data.anchor}`, 'note_detail_open', { chapter: this.content.id, anchor: data.anchor });
      });
      node.append(more, el('p', '', data.text));
      if (data.ref) {
        const a = el('a', '', `${data.ref.label} ↗`);
        a.href = data.ref.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.addEventListener('click', () => track('note_link_click', { chapter: this.content.id, label: data.ref!.label }));
        node.append(a);
      }
      layer.append(node);
      return { data, el: node, fade: 0 };
    });
    this.stage.append(layer);
  }

  private buildLegend(): void {
    const legend = this.content.legend;
    if (!legend?.length) return;
    const box = el('div', 'legend');
    legend.forEach(({ label, hue }) => {
      const s = el('span', '', label);
      s.style.setProperty('--hue', css(hue));
      box.append(s);
    });
    this.stage.append(box);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scene.resize(w, h);
  }

  /** Advance one frame: read scroll position, update copy, paint. */
  update(t: number, reduced: boolean): void {
    const r = this.el.getBoundingClientRect();
    const span = Math.max(1, r.height - this.scene.h);
    this.target = clamp(-r.top / span);
    // Snap on the first frame so a deep link or reload doesn't replay the whole chapter.
    this.p = reduced || !this.started ? this.target : lerp(this.p, this.target, 0.14);
    this.started = true;
    if (Math.abs(this.p - this.target) < 0.0005) this.p = this.target;

    for (const m of [25, 50, 75, 100]) if (this.target * 100 >= m - 1) trackOnce(`progress:${this.content.id}:${m}`, 'chapter_progress', { chapter: this.content.id, percent: m });
    this.updateBeats();
    // The career stage is announced as the chapter opens, then recedes behind the story.
    this.era?.classList.toggle('intro', this.target < 0.07);
    this.onProgress(this.p);

    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    this.speed = lerp(this.speed, this.hovering ? HOVER_SPEED : 1, 0.08);
    this.clock += dt * this.speed;
    if (this.speedChip) {
      this.speedChip.classList.toggle('fast', this.hovering);
      this.speedChip.textContent = this.hovering ? `${HOVER_SPEED}× speed` : 'Hover to speed up';
      const b = this.scene.box;
      this.speedChip.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y + b.h + 14)}px)`;
    }

    const { ctx, scene } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, scene.w, scene.h);
    scene.draw(this.p, this.clock);
    this.updateNotes();
  }

  /** Hook for chapters that drive DOM from progress. */
  protected onProgress(_p: number): void {}

  private updateBeats(): void {
    if (!this.beats.length) return;
    const p = this.target;
    let active = this.beats.findIndex((b) => p >= b.data.from && p < b.data.to);
    if (active < 0) active = p < this.beats[0].data.from ? 0 : this.beats.length - 1;
    if (active !== this.active) {
      trackOnce(`beat:${this.content.id}:${active}`, 'beat_view', { chapter: this.content.id, beat: active, title: this.beats[active].data.title });
      this.beats.forEach((b, i) => {
        b.el.classList.toggle('on', i === active);
        b.el.classList.toggle('past', i < active);
      });
      this.active = active;
      const next = this.beats[active + 1]?.data.title ?? this.nextTitle;
      if (this.hint) {
        this.hint.textContent = next ? `Next · ${next}` : '';
        this.hint.classList.toggle('none', !next);
      }
    }
    this.beats.forEach((b, i) => {
      const local = i < active ? 1 : i > active ? 0 : clamp((p - b.data.from) / (b.data.to - b.data.from));
      (b.step.firstChild as HTMLElement).style.transform = `scaleY(${local})`;
    });
    // The hint brightens as the next beat approaches, so it reads as "keep going".
    if (this.hint) {
      const b = this.beats[active].data;
      const local = clamp((p - b.from) / (b.to - b.from));
      this.hint.style.opacity = String(0.35 + 0.5 * clamp((local - 0.45) / 0.5));
    }
  }

  private updateNotes(): void {
    const { scene } = this, p = this.p, narrow = scene.narrow, box = scene.box;
    for (const n of this.notes) {
      const on = p >= n.data.from && p < n.data.to;
      n.el.classList.toggle('on', on);
      n.fade = lerp(n.fade, on ? 1 : 0, 0.12);
      const a = scene.anchors.get(n.data.anchor);
      if (!a || n.fade < 0.01) continue;
      const nh = n.el.offsetHeight;
      let x: number, y: number;
      if (narrow) {
        x = 12;
        y = box.y + box.h - nh - 6;
        n.el.style.width = n.el.classList.contains('open') ? `${scene.w - 24}px` : 'auto';
      } else {
        const nw = noteWidth(scene.w);
        const { at, dx = 0, dy = 0 } = n.data;
        x = clamp(at ? box.x + at.x * box.w : a.x + dx, box.x, scene.w - nw - 16);
        y = clamp(at ? box.y + at.y * box.h : a.y + dy, 70, scene.h - nh - 60);
        n.el.style.width = `${nw}px`;
      }
      n.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      this.leader(a, x, y, nh, n.fade, narrow ? n.el.offsetWidth : noteWidth(scene.w));
    }
  }

  /** Thin line from the anchor to the nearest edge of its note. */
  private leader(a: Point, x: number, y: number, h: number, fade: number, width: number): void {
    const tx = clamp(a.x, x, x + width), ty = clamp(a.y, y, y + h);
    const p = this.paint;
    p.line(a.x, a.y, tx, ty, 'copper', 0.6 * fade, 1, [2, 3]);
    p.dot(a.x, a.y, 2.5, 'copper', fade);
    p.ring(a.x, a.y, 6 + 2 * Math.sin(performance.now() / 300), 'copper', 0.7 * fade, 1);
  }
}
