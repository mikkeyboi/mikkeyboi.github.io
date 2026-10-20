import { el } from '../core/dom';
import { css, type Hue } from '../core/color';
import { hash, vnoise } from '../core/math';
import { POSTS } from '../content/posts';
import { PROFILE } from '../content/profile';
import { siteUrl } from '../core/site';
import { track } from '../core/analytics';

const NS = 'http://www.w3.org/2000/svg';

/** A generative cover: quiet traces with one coloured signal, unique per post. */
function cover(seed: number, hue: Hue): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 150');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (let l = 0; l < 7; l++) {
    let d = '';
    for (let x = 0; x <= 300; x += 4) {
      const y = 22 + l * 18 + Math.sin(x * (0.02 + hash(seed + l) * 0.03) + l) * 6 * hash(seed * 3 + l) + vnoise(x * 0.06 + seed * 10 + l * 7) * 5;
      d += `${x ? 'L' : 'M'}${x},${y.toFixed(1)}`;
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', css(l === 3 ? hue : 'grey', l === 3 ? 0.95 : 0.25));
    path.setAttribute('stroke-width', l === 3 ? '1.8' : '1');
    svg.append(path);
  }
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', String(60 + hash(seed * 7) * 180));
  c.setAttribute('cy', '76');
  c.setAttribute('r', '4');
  c.setAttribute('fill', css(hue));
  svg.append(c);
  return svg;
}

export function writingSection(): HTMLElement {
  const section = el('section', 'writing');
  section.id = 'writing';
  const head = el('div', 'writing-head');
  head.append(
    el('p', 'kicker', 'Writing'),
    el('h2', '', 'The long version.'),
    el('p', '', 'Every chapter here has a slower, deeper read, in a conventional reading view.'),
  );
  const all = el('a', 'all-writing', 'All writing and the RSS feed →');
  all.href = siteUrl('/writing.html');
  head.append(all);
  const cards = el('div', 'cards');
  POSTS.forEach((post, i) => {
    const a = el('a', 'card');
    a.href = siteUrl(`/posts/${post.slug}/`);
    a.addEventListener('click', () => track('post_card_click', { slug: post.slug }));
    const body = el('div', 'card-body');
    body.append(el('span', 'card-tag', post.tag), el('h3', '', post.title), el('p', '', post.blurb), el('span', 'card-go', 'Read →'));
    a.append(cover(i + 1.37, post.hue), body);
    a.style.transitionDelay = `${(i % 3) * 90}ms`;
    cards.append(a);
  });
  section.append(head, cards);
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  cards.querySelectorAll('.card').forEach((c) => io.observe(c));
  return section;
}

/** Credentials and a small citations-per-year chart. */
function record(): HTMLElement {
  const wrap = el('div', 'record');
  const creds = el('div', 'creds');
  creds.append(el('p', 'kicker', 'Credentials & roles'));
  const list = el('ul');
  PROFILE.credentials.forEach((c) => list.append(el('li', '', c)));
  creds.append(list);

  const { citations: cit } = PROFILE;
  const chart = el('div', 'cites');
  const head = el('p', 'kicker', 'Citations · Google Scholar');
  const total = el('a', 'cites-total');
  total.href = cit.url;
  total.append(el('b', '', String(cit.total)), document.createTextNode(' citations ↗'));
  const bars = el('div', 'cites-bars');
  bars.setAttribute('role', 'img');
  bars.setAttribute('aria-label', `Citations per year: ${cit.byYear.map(([y, n]) => `${y}: ${n}`).join(', ')}`);
  const max = Math.max(...cit.byYear.map(([, n]) => n));
  cit.byYear.forEach(([year, n], i) => {
    const col = el('div', 'cites-col');
    const bar = el('i');
    bar.style.setProperty('--h', `${Math.round((n / max) * 78)}px`);
    bar.style.transitionDelay = `${i * 60}ms`;
    col.append(el('span', 'cites-n', String(n)), bar, el('span', 'cites-y', `'${String(year).slice(2)}`));
    bars.append(col);
  });
  chart.append(head, total, bars, el('p', 'fine', `As of ${cit.asOf}`));
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { bars.classList.add('in'); io.disconnect(); }
  }), { threshold: 0.4 });
  io.observe(bars);

  wrap.append(creds, chart);
  return wrap;
}

export function footer(): HTMLElement {
  const end = el('footer', 'end');
  end.id = 'contact';
  const links = el('p', 'end-links');
  PROFILE.links.forEach(({ label, url }) => {
    const a = el('a', '', label);
    a.href = url;
    links.append(a);
  });
  end.append(el('h2', '', PROFILE.closing), links, record(), el('p', 'fine', PROFILE.education));
  return end;
}
