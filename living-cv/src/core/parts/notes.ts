import { clamp, lerp, type Point } from '../math';
import { el } from '../dom';
import { track, trackOnce } from '../analytics';
import type { Painter } from '../painter';
import type { Note } from '../../content/types';
import type { ChapterFrame, StagePart } from './part';

interface NoteView { data: Note; el: HTMLElement; fade: number }

/** Note width on wide screens: narrower on small desktops so notes fit beside the visual. */
const noteWidth = (w: number) => Math.round(Math.min(280, Math.max(220, w * 0.2)));

/**
 * Short details pinned to points on the visual, each joined to its anchor by a leader line.
 * On phones a note collapses to a chip that expands on tap.
 */
export class NoteLayer implements StagePart {
  readonly el = el('div', 'notes');
  private readonly notes: NoteView[];

  constructor(notes: Note[], private readonly paint: Painter, chapterId: string) {
    this.notes = notes.map((data) => {
      const node = el('aside', 'note');
      const more = el('button', 'note-more', 'Detail');
      more.type = 'button';
      more.addEventListener('click', () => {
        node.classList.toggle('open');
        trackOnce(`note-open:${data.anchor}`, 'note_detail_open', { chapter: chapterId, anchor: data.anchor });
      });
      node.append(more, el('p', '', data.text));
      if (data.ref) {
        const { label, url } = data.ref;
        const a = el('a', '', `${label} ↗`);
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.addEventListener('click', () => track('note_link_click', { chapter: chapterId, label }));
        node.append(a);
      }
      this.el.append(node);
      return { data, el: node, fade: 0 };
    });
  }

  update({ p, scene }: ChapterFrame): void {
    const box = scene.box;
    for (const n of this.notes) {
      const on = p >= n.data.from && p < n.data.to;
      n.el.classList.toggle('on', on);
      n.fade = lerp(n.fade, on ? 1 : 0, 0.12);
      const a = scene.anchors.get(n.data.anchor);
      if (!a || n.fade < 0.01) continue;
      const nh = n.el.offsetHeight;
      let x: number, y: number, width: number;
      if (scene.narrow) {
        x = 12;
        y = box.y + box.h - nh - 6;
        n.el.style.width = n.el.classList.contains('open') ? `${scene.w - 24}px` : 'auto';
        width = n.el.offsetWidth;
      } else {
        width = noteWidth(scene.w);
        const { at, dx = 0, dy = 0 } = n.data;
        x = clamp(at ? box.x + at.x * box.w : a.x + dx, box.x, scene.w - width - 16);
        y = clamp(at ? box.y + at.y * box.h : a.y + dy, 70, scene.h - nh - 60);
        n.el.style.width = `${width}px`;
      }
      n.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      this.leader(a, x, y, width, nh, n.fade);
    }
  }

  /** Thin line from the anchor to the nearest edge of its note. */
  private leader(a: Point, x: number, y: number, w: number, h: number, fade: number): void {
    const P = this.paint, tx = clamp(a.x, x, x + w), ty = clamp(a.y, y, y + h);
    P.line(a.x, a.y, tx, ty, 'copper', 0.6 * fade, 1, [2, 3]);
    P.dot(a.x, a.y, 2.5, 'copper', fade);
    P.ring(a.x, a.y, 6 + 2 * Math.sin(performance.now() / 300), 'copper', 0.7 * fade, 1);
  }
}
