import { clamp } from '../math';
import { el } from '../dom';
import { track, trackOnce } from '../analytics';
import type { Beat } from '../../content/types';
import type { ChapterFrame, StagePart } from './part';

interface BeatView { data: Beat; el: HTMLElement; fill: HTMLElement }

/**
 * The caption column: one beat at a time, a progress step per beat, and a hint naming
 * what comes next that brightens as it approaches.
 */
export class Captions implements StagePart {
  readonly el = el('div', 'captions');
  private readonly beats: BeatView[];
  private readonly hint = el('div', 'hint');
  private active = -1;

  constructor(beats: Beat[], private readonly chapterId: string, private readonly nextTitle?: string) {
    const steps = el('div', 'steps');
    steps.setAttribute('aria-hidden', 'true');
    this.beats = beats.map((data) => {
      const node = Captions.render(data, chapterId);
      const step = el('i'), fill = el('b');
      step.append(fill);
      steps.append(step);
      this.el.append(node);
      return { data, el: node, fill };
    });
    this.el.append(steps, this.hint);
  }

  private static render(data: Beat, chapterId: string): HTMLElement {
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
      const { label, url } = data.link;
      const a = el('a', 'beat-link', `${label} →`);
      a.href = url;
      a.addEventListener('click', () => track('beat_link_click', { chapter: chapterId, label }));
      const line = el('p');
      line.append(a);
      node.append(line);
    }
    return node;
  }

  update({ target: p }: ChapterFrame): void {
    let active = this.beats.findIndex((b) => p >= b.data.from && p < b.data.to);
    if (active < 0) active = p < this.beats[0].data.from ? 0 : this.beats.length - 1;
    if (active !== this.active) this.activate(active);
    this.beats.forEach((b, i) => {
      const local = i < active ? 1 : i > active ? 0 : clamp((p - b.data.from) / (b.data.to - b.data.from));
      b.fill.style.transform = `scaleY(${local})`;
    });
    // The hint brightens as the next beat approaches, so it reads as "keep going".
    const cur = this.beats[active].data;
    this.hint.style.opacity = String(0.35 + 0.5 * clamp(((p - cur.from) / (cur.to - cur.from) - 0.45) / 0.5));
  }

  private activate(active: number): void {
    trackOnce(`beat:${this.chapterId}:${active}`, 'beat_view', { chapter: this.chapterId, beat: active, title: this.beats[active].data.title });
    this.beats.forEach((b, i) => {
      b.el.classList.toggle('on', i === active);
      b.el.classList.toggle('past', i < active);
    });
    this.active = active;
    const next = this.beats[active + 1]?.data.title ?? this.nextTitle;
    this.hint.textContent = next ? `Next · ${next}` : '';
    this.hint.classList.toggle('none', !next);
  }
}
