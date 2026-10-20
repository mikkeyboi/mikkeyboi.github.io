import { css, type Hue } from '../color';
import { el } from '../dom';
import type { StagePart } from './part';

/** What the colours in this chapter's visual mean. */
export class Legend implements StagePart {
  readonly el = el('div', 'legend');

  constructor(items: { label: string; hue: Hue }[]) {
    for (const { label, hue } of items) {
      const s = el('span', '', label);
      s.style.setProperty('--hue', css(hue));
      this.el.append(s);
    }
  }
}
