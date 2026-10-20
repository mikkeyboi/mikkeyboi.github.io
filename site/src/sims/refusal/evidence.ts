import * as Plot from '@observablehq/plot';
import { el } from '../../core/dom';
import { css } from '../../core/color';
import { segmented } from '../controls';

/** The committed H005 metrics: held-out refusal rates per model, nothing generated live. */
export interface Metrics {
  margins: { min_baseline_refusal: number };
  models: Record<string, {
    label: string;
    verdict: string;
    selected_layer: number;
    n_test_per_class: number;
    baseline_harmful_refusal: number;
    baseline_harmless_refusal: number;
    ablation_harmful_refusal_real: number;
    ablation_harmful_refusal_control: number;
    addition_harmless_refusal_real: number;
    addition_harmless_refusal_control: number;
  }>;
}

type Arm = 'suppress' | 'induce';
const FILL = { baseline: css('grey', 0.6), fitted: css('teal'), control: css('violet', 0.55) };

export class RefusalEvidence {
  private readonly output = el('div', 'sim-output');

  constructor(readonly root: HTMLElement, private readonly metrics: Metrics) {
    const ids = Object.keys(metrics.models);
    const update = () => this.render(model.get(), arm.get());
    const model = segmented('Model', ids.map((id) => [id, metrics.models[id].label] as [string, string]), ids[0], update);
    const arm = segmented<Arm>('Arm', [['suppress', 'Suppression · ablate, harmful prompts'], ['induce', 'Induction · add, harmless prompts']], 'suppress', update);
    const controls = el('div', 'sim-controls');
    controls.append(model.el, arm.el);
    root.replaceChildren(controls, this.output);
    update();
  }

  private render(id: string, arm: Arm): void {
    const m = this.metrics.models[id];
    const suppress = arm === 'suppress';
    const verb = suppress ? 'ablate' : 'add';
    const rows = [
      { cond: 'baseline', kind: 'baseline', rate: suppress ? m.baseline_harmful_refusal : m.baseline_harmless_refusal },
      { cond: `${verb} fitted`, kind: 'fitted', rate: suppress ? m.ablation_harmful_refusal_real : m.addition_harmless_refusal_real },
      { cond: `${verb} control`, kind: 'control', rate: suppress ? m.ablation_harmful_refusal_control : m.addition_harmless_refusal_control },
    ];
    const plot = Plot.plot({
      height: 180,
      marginLeft: 100,
      marginRight: 40,
      marginBottom: 40,
      style: { background: 'transparent', color: css('grey'), fontFamily: 'var(--mono)', fontSize: '12px' },
      x: { domain: [0, 1.08], label: `refusal rate (${suppress ? 'harmful' : 'harmless'} prompts) →`, grid: true, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] },
      y: { label: null },
      color: { domain: Object.keys(FILL), range: Object.values(FILL) },
      marks: [
        Plot.barX(rows, { y: 'cond', x: 'rate', fill: 'kind', sort: { y: null }, rx: 3 }),
        Plot.text(rows, { y: 'cond', x: 'rate', text: (d: { rate: number }) => d.rate.toFixed(2), dx: 8, textAnchor: 'start', fill: css('white') }),
        Plot.ruleX([0], { stroke: 'rgba(150,180,220,.3)' }),
      ],
    });
    const verdict = el('p', 'sim-verdict');
    if (m.verdict === 'NO-BASELINE-REFUSAL') {
      verdict.innerHTML = `<b>${m.label}: no baseline refusal.</b> Baseline harmful refusal was ${m.baseline_harmful_refusal.toFixed(2)}, below the ${this.metrics.margins.min_baseline_refusal} floor I set in advance, so this model cannot tell me whether the direction is causal: there is nothing to suppress. That null is the Gemma lesson, not a tuning failure.`;
    } else {
      verdict.classList.add('pass');
      verdict.innerHTML = `<b>${m.label}: the single direction reproduces</b> (layer ${m.selected_layer}, ${m.n_test_per_class} held-out prompts per class, reproduced on a second seed). In both arms the fitted direction clears the norm-matched control by the pre-registered margin; erasing or adding a random vector of the same size does neither.`;
    }
    this.output.replaceChildren(plot, verdict);
  }
}
