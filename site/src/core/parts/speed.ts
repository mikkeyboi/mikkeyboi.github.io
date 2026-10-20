import { lerp } from '../math';
import { el } from '../dom';
import { trackOnce } from '../analytics';
import type { Scene } from '../scene';
import type { StagePart } from './part';

/** Time runs this much faster while the reader asks for it. */
const FAST = 3;

/**
 * The chapter's clock. Visuals run slowly by default; hovering the visual or the chip speeds
 * them up, and clicking the chip (or tapping it on touch screens) keeps them fast until clicked again.
 */
export class SpeedControl implements StagePart {
  readonly el: HTMLButtonElement;
  private clock = 0;
  private lastWall = -1;
  private speed = 1;
  private overVisual = false;
  private overChip = false;
  private pinned = false;
  /** Touch screens have no hover, so the chip becomes a tap toggle. */
  private readonly touch = matchMedia('(hover: none)').matches;

  constructor(private readonly stage: HTMLElement, private readonly scene: Scene, private readonly chapterId: string, showChip: boolean) {
    this.el = el('button', 'speed-chip');
    this.el.type = 'button';
    this.el.hidden = !showChip;
    this.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.overChip = true; });
    this.el.addEventListener('pointerleave', () => { this.overChip = false; });
    this.el.addEventListener('click', () => {
      this.pinned = !this.pinned;
      this.el.setAttribute('aria-pressed', String(this.pinned));
    });
    this.el.setAttribute('aria-pressed', 'false');
    stage.addEventListener('pointerleave', () => { this.overVisual = false; });
    this.trackPointer();
  }

  private trackPointer(): void {
    this.stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = this.stage.getBoundingClientRect(), b = this.scene.box;
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.overVisual = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    });
  }

  get fast(): boolean {
    return this.pinned || this.overVisual || this.overChip;
  }

  /** Advance the chapter clock by wall time scaled to the current speed. */
  tick(wall: number): number {
    const dt = this.lastWall < 0 ? 0 : Math.min(0.1, Math.max(0, wall - this.lastWall));
    this.lastWall = wall;
    this.speed = lerp(this.speed, this.fast ? FAST : 1, 0.08);
    this.clock += dt * this.speed;
    return this.clock;
  }

  update(): void {
    const fast = this.fast;
    if (fast) trackOnce(`speed:${this.chapterId}`, 'speed_up', { chapter: this.chapterId, pinned: this.pinned });
    this.el.classList.toggle('fast', fast);
    const verb = this.touch ? 'Tap' : 'Click';
    this.el.textContent = this.pinned ? `${FAST}× speed · ${verb.toLowerCase()} to slow` : fast ? `${FAST}× speed` : this.touch ? 'Tap to speed up' : 'Hover to speed up';
    const b = this.scene.box;
    this.el.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y + b.h + 14)}px)`;
  }
}
