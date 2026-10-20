import { track, trackOnce } from '../../core/analytics';

/**
 * The reading view's behaviour: a progress bar along the top, and the contents rail that follows
 * the section in view. Works on a full post page and inside the CV's quick view.
 */
export class PostReader {
  private constructor(private readonly root: ParentNode, private readonly scroller: HTMLElement | Window) {}

  static attach(root: ParentNode, scroller: HTMLElement | Window = window): PostReader {
    const reader = new PostReader(root, scroller);
    reader.progress();
    reader.contents();
    return reader;
  }

  private progress(): void {
    const bar = this.root.querySelector<HTMLElement>('.read-progress i');
    const prose = this.root.querySelector<HTMLElement>('[data-prose]');
    if (!bar || !prose) return;
    const slug = this.root.querySelector<HTMLElement>('[data-slug]')?.dataset.slug ?? '';
    const update = () => {
      const r = prose.getBoundingClientRect();
      const view = this.scroller instanceof Window ? innerHeight : this.scroller.clientHeight;
      const p = Math.min(1, Math.max(0, (view * 0.5 - r.top) / r.height));
      bar.style.transform = `scaleX(${p})`;
      for (const q of [25, 50, 75, 100]) if (p * 100 >= q - 1) trackOnce(`${slug}:${q}`, 'post_read_depth', { slug, depth: q });
    };
    this.scroller.addEventListener('scroll', update, { passive: true });
    update();
  }

  private contents(): void {
    const links = [...this.root.querySelectorAll<HTMLAnchorElement>('[data-toc]')];
    const heads = links.map((a) => this.root.querySelector<HTMLElement>(`#${CSS.escape(a.dataset.toc!)}`));
    if (!links.length) return;
    // The current section is the last heading above the upper third of the view.
    const update = () => {
      const top = this.scroller instanceof Window ? 0 : this.scroller.getBoundingClientRect().top;
      const view = this.scroller instanceof Window ? innerHeight : this.scroller.clientHeight;
      let active = -1;
      heads.forEach((h, i) => { if (h && h.getBoundingClientRect().top - top < view * 0.33) active = i; });
      links.forEach((a, i) => a.toggleAttribute('aria-current', i === active));
    };
    this.scroller.addEventListener('scroll', update, { passive: true });
    update();
    links.forEach((a) => a.addEventListener('click', () => track('toc_click', { section: a.dataset.toc! })));
  }
}
