import type { Chapter } from './chapter';
import { el } from './dom';
import { track } from './analytics';

export interface RailItem { id: string; label: string }

/** Owns the frame loop: only chapters near the viewport are painted. */
export class Engine {
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private rail?: HTMLElement;
  private railLinks: HTMLAnchorElement[] = [];
  private sections: HTMLElement[] = [];
  /** The section being read and since when, for time-in-chapter analytics. */
  private reading: { id: string; since: number } | null = null;

  constructor(private readonly chapters: Chapter[]) {}

  mountRail(items: RailItem[]): void {
    const rail = el('nav', 'rail');
    rail.setAttribute('aria-label', 'Chapters');
    this.railLinks = items.map(({ id, label }) => {
      const a = el('a');
      a.href = `#${id}`;
      a.dataset.for = id;
      a.append(el('i'), el('span', '', label));
      rail.append(a);
      return a;
    });
    document.body.append(rail);
    this.rail = rail;
  }

  start(): void {
    this.sections = [...document.querySelectorAll<HTMLElement>('main > section')];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        const ch = this.chapters.find((c) => c.el === en.target);
        if (ch) ch.visible = en.isIntersecting;
      }),
      { rootMargin: '120px 0px' },
    );
    this.chapters.forEach((c) => { c.resize(); io.observe(c.el); });
    window.addEventListener('resize', () => this.chapters.forEach((c) => c.resize()));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flushReading(); });
    this.jumpToMoment();
    requestAnimationFrame(this.frame);
  }

  /** Deep links to a moment inside a chapter: #neuro@0.64 scrolls 64% of the way through it. */
  private jumpToMoment(): void {
    const m = /^#([\w-]+)@(0?\.\d+|1|0)$/.exec(location.hash);
    const target = m && document.getElementById(m[1]);
    if (!target) return;
    const y = target.offsetTop + (target.offsetHeight - innerHeight) * parseFloat(m[2]);
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    document.documentElement.style.scrollBehavior = '';
  }

  private frame = (now: number): void => {
    const t = this.reduced ? 0 : now / 1000;
    for (const c of this.chapters) if (c.visible) c.update(t, this.reduced);
    this.updateRail();
    requestAnimationFrame(this.frame);
  };

  private noteReading(active: string | null): void {
    if (active === (this.reading?.id ?? null)) return;
    this.flushReading();
    if (active) {
      this.reading = { id: active, since: performance.now() };
      track('chapter_enter', { chapter: active });
    } else this.reading = null;
  }

  /** Report time spent in the current section (also called when the page is hidden). */
  flushReading(): void {
    if (!this.reading) return;
    const seconds = Math.round((performance.now() - this.reading.since) / 100) / 10;
    if (seconds >= 1) track('chapter_time', { chapter: this.reading.id, seconds });
    this.reading.since = performance.now();
  }

  private updateRail(): void {
    if (!this.rail) return;
    const mid = innerHeight / 2;
    let active: string | null = null;
    let railId: string | null = null;
    for (const s of this.sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) active = s.id;
    }
    // Chapters without their own rail entry light up the entry before them.
    for (const s of this.sections) {
      if (this.railLinks.some((a) => a.dataset.for === s.id)) railId = s.id;
      if (s.id === active) break;
    }
    this.noteReading(active);
    this.rail.classList.toggle('show', active !== null && active !== 'top');
    this.railLinks.forEach((a) => a.classList.toggle('on', a.dataset.for === railId));
  }
}
