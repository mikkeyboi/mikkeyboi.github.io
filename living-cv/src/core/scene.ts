import { Painter } from './painter';
import type { Box, Point } from './math';

/**
 * A scene paints one chapter's visual for a scroll progress p in 0..1 and a clock t in seconds.
 * Subclasses own their geometry and particles; the chapter owns DOM, captions and notes.
 */
export abstract class Scene {
  w = 0;
  h = 0;
  protected readonly paint: Painter;
  protected readonly ctx: CanvasRenderingContext2D;
  /** Points of interest the chapter can pin notes to, refreshed on every draw. */
  readonly anchors = new Map<string, Point>();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.paint = new Painter(ctx);
  }

  get narrow(): boolean {
    return this.w <= 860;
  }

  /** Drawing area beside the captions on wide screens, above them on narrow ones. */
  get box(): Box {
    if (!this.narrow) {
      // Start right of the caption column (see .captions in chapter.css), never under it.
      const gutter = Math.min(56, Math.max(16, this.w * 0.04));
      const x = Math.max(this.w * 0.36, gutter + 34 + Math.min(this.w * 0.3, 440) + 28);
      return { x, y: 64, w: this.w * 0.97 - x, h: this.h - 120 };
    }
    return { x: 0, y: 56, w: this.w, h: this.h * 0.56 };
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.layout();
  }

  /** Recompute cached geometry after a resize. */
  protected layout(): void {}

  protected mark(id: string, x: number, y: number): void {
    this.anchors.set(id, { x, y });
  }

  /** Optional DOM controls layered over the visual (sliders, toggles). Interactive scenes override. */
  controls(): HTMLElement | null {
    return null;
  }

  abstract draw(p: number, t: number): void;
}
