/**
 * The simulations on /playground. Adding one is an entry here plus a widget that mountSims knows.
 *
 *   id         stable slug (also the URL hash)
 *   blurb      one sentence: what it is
 *   what       what it shows, and what it does not
 *   scenarios  concrete things to try
 *   post       the full write-up
 */
export interface Simulation {
  id: string;
  sim: string;
  title: string;
  blurb: string;
  what: string;
  scenarios: { label: string; do: string }[];
  post: string;
}

export const SIMULATIONS: Simulation[] = [
  {
    id: 'refusal-direction',
    sim: 'refusal-toy',
    title: 'Refusal as a single direction',
    blurb: "Steer a synthetic model's refusal by ablating or adding one direction, against a norm-matched random control.",
    what:
      'A toy model whose refusal is, by construction, one planted direction: it refuses a prompt exactly when that prompt’s activation projects past a threshold θ onto that axis. Difference-of-means recovers the axis; you can ablate it (suppression) or add it (induction) and watch the decision move. It is not a real language model. It runs a 64-dimensional synthetic model live in your browser, so the shape of the result is real but the specific numbers are a toy.',
    scenarios: [
      { label: 'Erase the direction, kill the refusal', do: 'Keep Arm on Suppress and Direction on Fitted. The harmful cloud sits right of θ (all refusing); ablation collapses it left of θ and the refusal rate drops to about 0.' },
      { label: 'The control is the whole experiment', do: 'Switch Direction to the random control. Same-size perturbation, but the cloud barely moves and the refusal rate stays high. The effect was about which direction, not how big.' },
      { label: 'Inject refusal into benign prompts', do: 'Set Arm to Induce. Watch five harmless-but-scary-looking requests slide from full help to refused as the added direction pushes them past θ.' },
      { label: "Find the instrument's floor", do: 'Drag θ up past the harmful cloud. Baseline refusal falls to near zero and there is nothing left to suppress: the same no-baseline-refusal outcome the real Gemma run hit.' },
    ],
    post: '/posts/05-h005-refusal-direction/',
  },
];
