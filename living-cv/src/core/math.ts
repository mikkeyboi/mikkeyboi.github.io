export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Progress of p through [a, b], clamped to 0..1. */
export const seg = (p: number, a: number, b: number): number => clamp((p - a) / (b - a));
export const ease = (t: number): number => t * t * (3 - 2 * t);
export const frac = (x: number): number => x - Math.floor(x);
/** Deterministic pseudo-random in 0..1, stable across frames. */
export const hash = (n: number): number => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
/** Smooth 1D value noise in -1..1. */
export const vnoise = (x: number): number => {
  const i = Math.floor(x);
  return lerp(hash(i), hash(i + 1), ease(x - i)) * 2 - 1;
};

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
