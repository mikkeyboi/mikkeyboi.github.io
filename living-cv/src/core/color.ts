export type RGB = readonly [number, number, number];

/** Copper is research; teal is reliable production. Everything else supports those two. */
export const PALETTE = {
  copper: [255, 154, 90],
  teal: [57, 225, 198],
  red: [255, 77, 109],
  violet: [165, 148, 255],
  sky: [110, 170, 255],
  mint: [120, 230, 140],
  amber: [255, 210, 120],
  white: [233, 237, 244],
  grey: [141, 153, 171],
  ink: [4, 6, 11],
} as const satisfies Record<string, RGB>;

export type Hue = keyof typeof PALETTE;
export type Colour = Hue | RGB;

const rgb = (c: Colour): RGB => (typeof c === 'string' ? PALETTE[c] : c);

export const mix = (a: Colour, b: Colour, t: number): RGB => {
  const u = Math.max(0, Math.min(1, t)), x = rgb(a), y = rgb(b);
  return [Math.round(x[0] + (y[0] - x[0]) * u), Math.round(x[1] + (y[1] - x[1]) * u), Math.round(x[2] + (y[2] - x[2]) * u)];
};

export const css = (c: Colour, alpha = 1): string => {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${alpha})`;
};
