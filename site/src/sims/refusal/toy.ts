import * as Plot from '@observablehq/plot';
import { el } from '../../core/dom';
import { css } from '../../core/color';
import { track } from '../../core/analytics';
import { segmented, slider } from '../controls';
import { simulate, type Arm, type Direction, type Tier } from './sim.mjs';

export interface ToyDefaults { arm?: Arm; direction?: Direction; doseScale?: number; theta?: number; seed?: number }

const TIERS: Record<Tier, string> = { full: 'full help', hedged: 'hedged', refused: 'refused' };
const INK = { before: css('grey', 0.55), after: css('teal'), rule: css('copper'), axis: css('grey') };

/**
 * The planted-refusal toy: ablate or add one direction against a norm-matched random control and
 * watch the held-out cloud, the refusal rate and five benign requests respond. The math is sim.mjs.
 */
export class RefusalToy {
  private readonly output = el('div', 'sim-output');
  private readonly read: () => Required<ToyDefaults>;

  constructor(readonly root: HTMLElement, defaults: ToyDefaults = {}) {
    const update = () => this.render();
    const arm = segmented<Arm>('Arm', [['suppress', 'Suppress · ablate, harmful set'], ['induce', 'Induce · add, harmless set']], defaults.arm ?? 'suppress', update);
    const dir = segmented<Direction>('Direction', [['fitted', 'Fitted refusal direction'], ['control', 'Norm-matched random control']], defaults.direction ?? 'fitted', update);
    const dose = slider('Addition dose (induce)', [0, 2, 0.1], defaults.doseScale ?? 1, update, (v) => `${v.toFixed(1)}×`);
    const theta = slider('Refusal threshold θ', [-2, 6, 0.25], defaults.theta ?? 1.5, update);
    const seed = slider('Seed (resample and refit)', [0, 9, 1], defaults.seed ?? 0, update, (v) => String(v));
    this.read = () => ({ arm: arm.get(), direction: dir.get(), doseScale: dose.get(), theta: theta.get(), seed: seed.get() });

    const controls = el('div', 'sim-controls');
    controls.append(arm.el, dir.el, dose.el, theta.el, seed.el);
    controls.addEventListener('change', () => track('sim_input', { sim: 'refusal-toy', ...this.read() }));
    root.replaceChildren(controls, this.output);
    this.render();
  }

  private render(): void {
    const opts = this.read();
    const toy = simulate(opts);
    const hist = [
      ...toy.projBefore.map((v) => ({ v, phase: 'before' })),
      ...toy.projAfter.map((v) => ({ v, phase: 'after' })),
    ];
    const plot = Plot.plot({
      height: 240,
      marginLeft: 44,
      marginTop: 30,
      style: { background: 'transparent', color: INK.axis, fontFamily: 'var(--mono)', fontSize: '12px' },
      x: { label: 'projection onto the refusal axis →', grid: true },
      y: { label: 'count' },
      color: { legend: true, domain: ['before', 'after'], range: [INK.before, INK.after] },
      marks: [
        Plot.rectY(hist, Plot.binX<Plot.RectYOptions>({ y: 'count' }, { x: 'v', fill: 'phase', fillOpacity: 0.75, thresholds: 36 })),
        Plot.ruleX([toy.theta], { stroke: INK.rule, strokeDasharray: '4 3', strokeWidth: 1.5 }),
        Plot.text([toy.theta], { x: (d: number) => d, text: () => 'θ · refuse →', dy: -16, dx: 6, fill: INK.rule, textAnchor: 'start', frameAnchor: 'top' }),
        Plot.ruleY([0], { stroke: 'rgba(150,180,220,.3)' }),
      ],
    });

    const suppress = opts.arm === 'suppress';
    const control = opts.direction === 'control';
    const stat = el('div', 'sim-stat');
    const rate = el('p', 'sim-rate');
    rate.innerHTML = `<span>Refusal rate, ${suppress ? 'harmful' : 'harmless'} set</span><b>${toy.rateBefore.toFixed(2)}</b><i>→</i><b class="${control ? '' : 'moved'}">${toy.rateAfter.toFixed(2)}</b>`;
    const why = el('p', 'sim-note', control
      ? 'The control is the same size and barely moves the cloud. The effect is about which direction, not how big.'
      : suppress ? 'Erasing the one direction drops refusal.' : 'Injecting it raises refusal on prompts that were harmless.');
    why.append(` Difference-of-means recovered the planted axis at cosine ${toy.cosine.toFixed(3)}.`);
    stat.append(rate, why);

    const intro = el('p', 'sim-note', `Five benign requests that only look risky. The decision is still projection > θ; how much help each gets is graded by its distance from the line, so watch the same request slide between tiers as ${suppress ? 'ablation pulls it below θ' : 'the added direction pushes it past θ'}.`);
    const table = el('table', 'sim-table');
    table.innerHTML = '<thead><tr><th>Benign request</th><th>Before</th><th>After</th><th>Response after</th></tr></thead>';
    const body = el('tbody');
    for (const e of toy.examples) {
      const tr = el('tr');
      tr.append(el('td', '', e.prompt), badge(e.tier_before), badge(e.tier_after), el('td', 'sim-quote', e.text_after));
      body.append(tr);
    }
    table.append(body);
    const scroller = el('div', 'sim-table-wrap');
    scroller.append(table);
    this.output.replaceChildren(plot, stat, intro, scroller);
  }
}

function badge(tier: Tier): HTMLTableCellElement {
  const td = el('td');
  td.append(el('span', `tier tier-${tier}`, TIERS[tier]));
  return td;
}
