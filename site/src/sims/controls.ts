import { el } from '../core/dom';

/** Small native controls for simulations, styled by sims.css. Each fires `onChange` on input. */

export function segmented<T extends string>(label: string, options: [T, string][], value: T, onChange: (v: T) => void): { el: HTMLElement; get: () => T } {
  const wrap = el('fieldset', 'sim-field');
  wrap.append(el('legend', '', label));
  const group = el('div', 'seg');
  const name = `seg-${Math.random().toString(36).slice(2)}`;
  let current = value;
  for (const [v, text] of options) {
    const id = `${name}-${v}`;
    const input = el('input');
    input.type = 'radio';
    input.name = name;
    input.id = id;
    input.value = v;
    input.checked = v === value;
    input.addEventListener('change', () => { current = v; onChange(v); });
    const lab = el('label', '', text);
    lab.htmlFor = id;
    group.append(input, lab);
  }
  wrap.append(group);
  return { el: wrap, get: () => current };
}

export function slider(label: string, [min, max, step]: [number, number, number], value: number, onChange: (v: number) => void, format = (v: number) => v.toFixed(2)): { el: HTMLElement; get: () => number } {
  const wrap = el('label', 'sim-field sim-range');
  const out = el('output', '', format(value));
  const head = el('span', 'sim-range-head');
  head.append(el('span', '', label), out);
  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const fill = () => input.style.setProperty('--p', `${((Number(input.value) - min) / (max - min)) * 100}%`);
  fill();
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); fill(); onChange(Number(input.value)); });
  wrap.append(head, input);
  return { el: wrap, get: () => Number(input.value) };
}
