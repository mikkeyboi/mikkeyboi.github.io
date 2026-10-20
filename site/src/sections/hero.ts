import { Chapter } from '../core/chapter';
import { el } from '../core/dom';
import { ease, seg } from '../core/math';
import { PROFILE } from '../content/profile';
import type { StagePart } from '../core/parts/part';

/** The hero's name block, fading out as the traces converge. */
class HeroCopy implements StagePart {
  readonly el = el('div', 'hero-copy');
  private readonly cue = el('a', 'hero-cue');

  constructor() {
    this.cue.href = '#bridge';
    this.cue.append(el('span', '', PROFILE.cue), el('i'));
    this.el.append(
      el('p', 'eyebrow', PROFILE.role),
      el('h1', '', PROFILE.name),
      el('p', 'legal', PROFILE.legalName),
      el('p', 'hero-line', PROFILE.line),
      this.cue,
    );
  }

  update({ p }: { p: number }): void {
    this.el.style.opacity = String(1 - ease(seg(p, 0.2, 0.6)));
    this.cue.classList.toggle('gone', p > 0.08);
  }
}

/** The opening chapter: a bespoke name block instead of caption beats. */
export class HeroChapter extends Chapter {
  protected addParts(): void {
    this.el.classList.add('scene-hero');
    this.parts.push(new HeroCopy());
  }
}
