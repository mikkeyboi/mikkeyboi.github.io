import { tsKernels } from './fallback';
import type { Kernels } from './types';

export * from './types';

let active: Kernels = tsKernels;

/**
 * Prefer the Rust kernels; fall back to TypeScript where WebAssembly is unavailable,
 * for example under a Content-Security-Policy without 'wasm-unsafe-eval'.
 */
export async function loadKernels(): Promise<Kernels> {
  try {
    const { loadWasmKernels } = await import('./wasm');
    active = await loadWasmKernels();
  } catch (err) {
    console.info('Rust kernels unavailable; using the TypeScript fallback.', err);
    active = tsKernels;
  }
  document.documentElement.dataset.kernels = active.backend;
  return active;
}

export const kernels = (): Kernels => active;
