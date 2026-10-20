import { css, type Hue } from './color';
import { hash, vnoise } from './math';

/**
 * A post's generative cover: quiet traces with one coloured signal, unique per seed. Returns SVG
 * markup so the same cover renders at build time (writing pages) and in the browser (the CV).
 */
export function coverSvg(seed: number, hue: Hue, className = ''): string {
  let paths = '';
  for (let l = 0; l < 7; l++) {
    let d = '';
    for (let x = 0; x <= 300; x += 4) {
      const y = 22 + l * 18 + Math.sin(x * (0.02 + hash(seed + l) * 0.03) + l) * 6 * hash(seed * 3 + l) + vnoise(x * 0.06 + seed * 10 + l * 7) * 5;
      d += `${x ? 'L' : 'M'}${x},${y.toFixed(1)}`;
    }
    const lead = l === 3;
    paths += `<path d="${d}" fill="none" stroke="${css(lead ? hue : 'grey', lead ? 0.95 : 0.25)}" stroke-width="${lead ? 1.8 : 1}" vector-effect="non-scaling-stroke"/>`;
  }
  // A zero-length round-capped stroke keeps the dot round and the same size however the cover stretches.
  const x = (60 + hash(seed * 7) * 180).toFixed(1);
  const dot = `<path d="M${x},76h0" stroke="${css(hue, 0.18)}" stroke-width="22" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    + `<path d="M${x},76h0" stroke="${css(hue)}" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${paths}${dot}</svg>`;
}

/** A stable seed per post, from its number, so a post keeps its cover wherever it appears. */
export const coverSeed = (slug: string): number => Number.parseInt(slug, 10) + 0.37;
