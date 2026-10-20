import { clamp, lerp } from './math';
import type { Scene } from './scene';
import type { ChapterContent } from '../content/types';
import { el } from './dom';
import { Painter } from './painter';
import { trackOnce } from './analytics';
import type { ChapterFrame, StagePart } from './parts/part';
import { Captions } from './parts/captions';
import { NoteLayer } from './parts/notes';
import { EraTimeline } from './parts/era';
import { Legend } from './parts/legend';
import { SpeedControl } from './parts/speed';

export type SceneCtor = new (ctx: CanvasRenderingContext2D) => Scene;

/**
 * A scroll-pinned chapter: a tall section with a sticky stage. The stage holds the scene's canvas
 * plus a set of parts (captions, notes, era timeline, legend, speed control), each updated per frame.
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
  protected readonly parts: StagePart[] = [];
  private readonly speed: SpeedControl;
  private dpr = 1;
  private started = false;

  constructor(readonly content: ChapterContent, SceneClass: SceneCtor, protected nextTitle?: string) {
    this.el = el('section', 'scene');
    this.el.id = content.id;
    this.el.style.height = `${content.length * 100}vh`;
    this.stage = el('div', 'stage');
    this.canvas = el('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    this.scene = new SceneClass(this.ctx);
    this.stage.append(this.canvas);
    this.el.append(this.stage);

    this.speed = new SpeedControl(this.stage, this.scene, content.id, !!content.speedHint);
    this.addParts();
    this.parts.push(this.speed);
    const controls = this.scene.controls();
    if (controls) this.stage.append(controls);
    for (const part of this.parts) this.stage.append(part.el);
  }

  /** The stage's layers. Subclasses with bespoke copy (the hero) override this. */
  protected addParts(): void {
    const { content } = this;
    if (content.beats.length) this.parts.push(new Captions(content.beats, content.id, this.nextTitle));
    if (content.notes?.length) this.parts.push(new NoteLayer(content.notes, new Painter(this.ctx), content.id));
    if (content.legend?.length) this.parts.push(new Legend(content.legend));
    if (content.era) this.parts.push(new EraTimeline(content.era));
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scene.resize(w, h);
  }

  /** Advance one frame: read scroll position, update the parts, paint the scene. */
  update(wall: number, reduced: boolean): void {
    const r = this.el.getBoundingClientRect();
    const span = Math.max(1, r.height - this.scene.h);
    this.target = clamp(-r.top / span);
    // Snap on the first frame so a deep link or reload doesn't replay the whole chapter.
    this.p = reduced || !this.started ? this.target : lerp(this.p, this.target, 0.14);
    this.started = true;
    if (Math.abs(this.p - this.target) < 0.0005) this.p = this.target;
    for (const m of [25, 50, 75, 100]) {
      if (this.target * 100 >= m - 1) trackOnce(`progress:${this.content.id}:${m}`, 'chapter_progress', { chapter: this.content.id, percent: m });
    }

    const { ctx, scene } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, scene.w, scene.h);
    scene.draw(this.p, this.speed.tick(wall));

    const frame: ChapterFrame = { p: this.p, target: this.target, scene, chapterId: this.content.id };
    for (const part of this.parts) part.update?.(frame);
  }
}
