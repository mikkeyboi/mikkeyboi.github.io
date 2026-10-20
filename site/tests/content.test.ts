import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/chapters';
import { REFS } from '../src/content/refs';
import { readdirSync, readFileSync } from 'node:fs';
import { PALETTE } from '../src/core/color';
import { PROFILE } from '../src/content/profile';

describe('chapter content', () => {
  it('has unique chapter ids', () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CHAPTERS.filter((c) => c.beats.length).map((c) => [c.id, c] as const))('%s: beats tile the chapter in order', (_id, c) => {
    expect(c.beats[0].from).toBe(0);
    expect(c.beats.at(-1)!.to).toBeGreaterThanOrEqual(1);
    c.beats.forEach((b, i) => {
      expect(b.to).toBeGreaterThan(b.from);
      if (i > 0) expect(b.from).toBeCloseTo(c.beats[i - 1].to, 5);
    });
  });

  it.each(CHAPTERS.flatMap((c) => (c.notes ?? []).map((n) => [c.id, n.anchor, n] as const)))('%s/%s: note has a window and a placement', (_c, _a, n) => {
    expect(n.to).toBeGreaterThan(n.from);
    expect(n.at !== undefined || n.dx !== undefined).toBe(true);
  });

  it('eras run forward in time', () => {
    for (const c of CHAPTERS) if (c.era?.end) expect(c.era.end).toBeGreaterThanOrEqual(c.era.start);
  });
});

describe('references and links', () => {
  it('are https or site-relative', () => {
    const urls = [...Object.values(REFS).map((r) => r.url), ...PROFILE.links.map((l) => l.url), PROFILE.citations.url];
    for (const u of urls) expect(u).toMatch(/^(https:\/\/|\/)/);
  });

  it('every post folder keeps the NN-slug URL shape and a known card hue', () => {
    const dir = new URL('../src/content/posts/', import.meta.url);
    const slugs = readdirSync(dir);
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(slug).toMatch(/^\d{2}-[a-z0-9-]+$/);
      const file = readdirSync(new URL(`${slug}/`, dir)).find((f) => /^index\.mdx?$/.test(f));
      const hue = readFileSync(new URL(`${slug}/${file}`, dir), 'utf8').match(/^hue: (\w+)$/m)?.[1];
      expect(Object.keys(PALETTE)).toContain(hue);
    }
  });

  it('yearly citations never exceed the total, which can include years not charted', () => {
    const sum = PROFILE.citations.byYear.reduce((a, [, n]) => a + n, 0);
    expect(sum).toBeLessThanOrEqual(PROFILE.citations.total);
  });
});
