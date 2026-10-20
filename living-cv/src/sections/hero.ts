import { Chapter } from '../core/chapter';
import { el } from '../core/dom';
import { ease, seg } from '../core/math';
import { PROFILE } from '../content/profile';

/** The opening chapter: bespoke name block instead of caption beats. */
export class HeroChapter extends Chapter {
  private copy?: HTMLElement;
  private cue?: HTMLElement;

  protected buildCopy(): void {
    this.el.classList.add('scene-hero');
    const copy = el('div', 'hero-copy');
    copy.append(
      el('p', 'eyebrow', PROFILE.role),
      el('h1', '', PROFILE.name),
      el('p', 'legal', PROFILE.legalName),
      el('p', 'hero-line', PROFILE.line),
    );
    const cue = el('a', 'hero-cue');
    cue.href = '#bridge';
    cue.append(el('span', '', PROFILE.cue), el('i'));
    copy.append(cue);
    this.stage.append(copy);
    this.copy = copy;
    this.cue = cue;
  }

  protected onProgress(p: number): void {
    if (this.copy) this.copy.style.opacity = String(1 - ease(seg(p, 0.2, 0.6)));
    if (this.cue) this.cue.classList.toggle('gone', p > 0.08);
  }
}
