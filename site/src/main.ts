import './styles/base.css';
import './styles/chapter.css';
import './styles/sections.css';
import { Chapter } from './core/chapter';
import { Engine } from './core/engine';
import { CHAPTERS } from './content/chapters';
import { SCENES } from './scenes';
import { HeroChapter } from './sections/hero';
import { footer, writingSection } from './sections/writing';
import { loadKernels } from './kernel';
import { track } from './core/analytics';
import { siteUrl } from './core/site';

function boot(): void {
  const main = document.querySelector('main')!;
  const chapters = CHAPTERS.map((content, i) => {
    const next = CHAPTERS[i + 1]?.beats[0];
    const nextTitle = next ? (next.kicker ? `${next.kicker.split(' · ')[0]} · ${next.title}` : next.title) : 'Writing';
    const Kind = content.scene === 'hero' ? HeroChapter : Chapter;
    return new Kind(content, SCENES[content.scene], nextTitle);
  });
  chapters.forEach((c) => main.append(c.el));
  main.append(writingSection(), footer());

  const engine = new Engine(chapters);
  engine.mountRail([
    ...CHAPTERS.filter((c) => c.rail).map((c) => ({ id: c.id, label: c.rail! })),
    { id: 'writing', label: 'Writing' },
  ]);
  engine.start();
}

document.querySelectorAll<HTMLAnchorElement>('a[data-path]').forEach((a) => { a.href = siteUrl(a.dataset.path!); });
// Kernels first: scenes take their compute backend when constructed.
loadKernels()
  .then((k) => track('kernel_backend', { backend: k.backend }))
  .finally(boot);
