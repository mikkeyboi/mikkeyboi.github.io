import { el } from '../dom';
import type { Era } from '../../content/types';
import type { ChapterFrame, StagePart } from './part';

/** The career axis every era timeline shares. */
const AXIS_FROM = 2017, AXIS_TO = 2027;
/** Raw progress below which the era is announced; after it, it recedes. */
const INTRO_UNTIL = 0.07;

/** A soft-focus career timeline: where this work sits in the arc, without competing with it. */
export class EraTimeline implements StagePart {
  readonly el = el('div', 'era');

  constructor(era: Era) {
    const span = `${era.start}–${era.end ?? 'present'}`;
    const at = (year: number) => `${((year - AXIS_FROM) / (AXIS_TO - AXIS_FROM)) * 100}%`;
    const end = (era.end ?? AXIS_TO - 1) + 1;
    this.el.setAttribute('aria-label', `${era.role}, ${era.org}, ${span}`);
    this.el.append(el('div', 'era-ghost', era.end ? `${era.start}–${String(era.end).slice(2)}` : `${era.start}–`));

    const axis = el('div', 'era-axis');
    const bar = el('i');
    bar.style.left = at(era.start);
    bar.style.width = `calc(${at(end)} - ${at(era.start)})`;
    axis.append(bar);
    for (let y = AXIS_FROM; y < AXIS_TO; y++) {
      const label = y === era.start ? String(y) : era.end && y === end ? String(era.end) : '';
      const tick = el('b', '', label);
      tick.style.left = at(y);
      axis.append(tick);
    }
    if (!era.end) {
      const now = el('b', 'now', 'now');
      now.style.left = '100%';
      axis.append(now);
    }
    this.el.append(axis, el('p', 'era-role', `${era.role} · ${era.org} · ${span}`));
  }

  update({ target }: ChapterFrame): void {
    this.el.classList.toggle('intro', target < INTRO_UNTIL);
  }
}
