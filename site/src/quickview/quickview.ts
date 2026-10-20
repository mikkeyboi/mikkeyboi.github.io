import { el } from '../core/dom';
import { track } from '../core/analytics';
import { PostReader } from '../components/post/reader';
import '../styles/writing.css';
import './quickview.css';

const POST_PATH = /\/posts\/(\d{2}-[a-z0-9-]+)\/?$/;
/** This site, plus the public hosts the private preview links to. */
const SITES = [location.origin, 'https://minwahleung.ca', 'https://mikkeyboi.github.io'];

/**
 * Posts open from the CV in a quick view: a sheet over the CV with the post's reading view, so a
 * visitor can skim and go back to the same spot in the story, or carry on into the full post.
 * The sheet loads the post's own page, so the full post and the quick view never drift apart.
 * Back (browser, Esc, the scrim or the button) closes it; ?read=<slug> links straight to it.
 */
export class QuickView {
  private readonly cache = new Map<string, Promise<Document>>();
  private readonly root = el('div', 'qv');
  private readonly sheet = el('section', 'qv-sheet');
  private readonly scroll = el('div', 'qv-scroll');
  private readonly full = el('a', 'qv-full');
  private slug = '';
  private opened = 0;
  private returnFocus: HTMLElement | null = null;

  private constructor() {
    this.root.hidden = true;
    const scrim = el('div', 'qv-scrim');
    scrim.addEventListener('click', () => this.dismiss());
    const back = el('button', 'qv-back');
    back.type = 'button';
    back.innerHTML = '<span aria-hidden="true">←</span> Back to the CV';
    back.addEventListener('click', () => this.dismiss());
    this.full.innerHTML = 'Open the full post <span aria-hidden="true">↗</span>';
    this.full.addEventListener('click', () => track('quickview_full', { slug: this.slug, seconds: this.seconds() }));
    const bar = el('header', 'qv-bar');
    bar.append(back, el('span', 'qv-label', 'Quick read'), this.full);
    const progress = el('div', 'read-progress');
    progress.append(el('i'));
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-label', 'Quick read');
    this.sheet.tabIndex = -1;
    this.sheet.append(bar, progress, this.scroll);
    this.root.append(scrim, this.sheet);
    document.body.append(this.root);
  }

  /** Route post links on this page through the quick view. */
  static attach(): QuickView {
    const qv = new QuickView();
    const slugOf = (a: HTMLAnchorElement | null): string | undefined => {
      if (!a || !SITES.includes(a.origin)) return undefined;
      return a.pathname.match(POST_PATH)?.[1];
    };
    document.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || qv.root.contains(a)) return;
      const slug = slugOf(a);
      if (!slug || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      qv.open(slug, a.href, a);
    });
    // Start loading on intent, so the sheet usually opens with the post already in hand.
    document.addEventListener('pointerover', (e) => {
      const slug = slugOf((e.target as Element | null)?.closest?.('a') ?? null);
      if (slug) void qv.load(slug, (e.target as Element).closest('a')!.href);
    });
    addEventListener('popstate', () => {
      const slug = new URLSearchParams(location.search).get('read');
      if (slug && slug !== qv.slug) qv.open(slug, `/posts/${slug}/`, null, false);
      else if (!slug && qv.slug) qv.close();
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && qv.slug) qv.dismiss(); });
    const initial = new URLSearchParams(location.search).get('read');
    if (initial && /^\d{2}-[a-z0-9-]+$/.test(initial)) qv.open(initial, `/posts/${initial}/`, null, false);
    return qv;
  }

  private load(slug: string, href: string): Promise<Document> {
    let doc = this.cache.get(slug);
    if (!doc) {
      doc = fetch(href).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      }).then((html) => new DOMParser().parseFromString(html, 'text/html'));
      doc.catch(() => this.cache.delete(slug));
      this.cache.set(slug, doc);
    }
    return doc;
  }

  async open(slug: string, href: string, from: HTMLElement | null, push = true): Promise<void> {
    if (push) history.pushState({ read: slug }, '', `${location.pathname}?read=${slug}${location.hash}`);
    this.slug = slug;
    this.opened = performance.now();
    this.returnFocus = from ?? (document.activeElement as HTMLElement | null);
    this.full.href = href;
    this.scroll.replaceChildren(el('p', 'qv-loading', 'Opening…'));
    this.root.hidden = false;
    document.documentElement.classList.add('qv-open');
    requestAnimationFrame(() => this.root.classList.add('in'));
    this.sheet.focus({ preventScroll: true });
    track('quickview_open', { slug, from: from?.closest('.card') ? 'card' : from ? 'note' : 'link' });

    try {
      const doc = await this.load(slug, href);
      if (this.slug !== slug) return;
      const article = doc.querySelector<HTMLElement>('article.post');
      if (!article) throw new Error('no article');
      const post = article.cloneNode(true) as HTMLElement;
      post.querySelectorAll('.toc, .post-end').forEach((n) => n.remove());
      this.sheet.style.cssText = article.getAttribute('style') ?? '';
      const end = el('div', 'qv-end');
      const more = el('a', 'qv-end-full', 'Keep reading in the full post →');
      more.href = href;
      const back = el('button', 'qv-end-back', '← Back to the CV');
      back.type = 'button';
      back.addEventListener('click', () => this.dismiss());
      end.append(more, back);
      this.scroll.replaceChildren(post, end);
      this.scroll.scrollTop = 0;
      // In-post anchors scroll the sheet, not the CV behind it.
      post.addEventListener('click', (e) => {
        const a = (e.target as Element).closest('a');
        const id = a?.getAttribute('href')?.startsWith('#') ? a.getAttribute('href')!.slice(1) : '';
        const target = id && post.querySelector(`#${CSS.escape(id)}`);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
      });
      PostReader.attach(this.sheet, this.scroll);
      if (post.querySelector('[data-sim]')) void import('../sims/mount').then((m) => m.mountSims(post));
    } catch {
      this.scroll.replaceChildren(el('p', 'qv-loading', 'This post did not load. Open the full post instead.'));
    }
  }

  /** Close through history when the sheet added an entry, so Back and the button agree. */
  private dismiss(): void {
    if (history.state?.read) history.back();
    else { history.replaceState(null, '', `${location.pathname}${location.hash}`); this.close(); }
  }

  private close(): void {
    track('quickview_close', { slug: this.slug, seconds: this.seconds() });
    this.slug = '';
    this.root.classList.remove('in');
    document.documentElement.classList.remove('qv-open');
    const done = () => { if (!this.slug) this.root.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else this.sheet.addEventListener('transitionend', done, { once: true });
    this.returnFocus?.focus({ preventScroll: true });
  }

  private seconds(): number {
    return Math.round((performance.now() - this.opened) / 1000);
  }
}
