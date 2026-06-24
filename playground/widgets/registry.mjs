// registry.mjs — the catalog of interactive simulations shown on /playground.
//
// Adding a new simulation to the site is a data edit here plus a widget factory
// in ./<name>_widget.mjs. The playground page renders whatever this lists; no
// page logic changes. Each entry is intentionally small and declarative.
//
//   id          stable slug (dropdown value, URL hash)
//   title       human label
//   blurb       one sentence: what it is
//   what        2-3 sentences: what it shows / what it does NOT
//   scenarios   concrete things to try, each a {label, do} pair
//   post        link to the full write-up
//   widget      async loader returning { render(container, deps) }
//   sim         async loader for the math module passed to the widget
//
// The loaders are functions (not eager imports) so the page only fetches the
// module for the simulation the visitor actually selects.

export const SIMULATIONS = [
  {
    id: "refusal-direction",
    title: "Refusal as a single direction",
    blurb:
      "Steer a synthetic model's refusal by ablating or adding one direction, against a norm-matched random control.",
    what:
      "A toy model whose refusal is, by construction, one planted direction: it refuses a prompt exactly when that prompt's activation projects past a threshold θ onto that axis. Difference-of-means recovers the axis; you can ablate it (suppression) or add it (induction) and watch the decision move. It is NOT a real language model — it runs a 64-dimensional synthetic model live in your browser, so the shape of the result is real but the specific numbers are a toy.",
    scenarios: [
      {
        label: "Erase the direction, kill the refusal",
        do: "Keep Arm = Suppress and Direction = Fitted. The harmful cloud sits right of θ (all refusing); ablation collapses it left of θ and the refusal rate drops to ~0.",
      },
      {
        label: "The control is the whole experiment",
        do: "Switch Direction to the random control. Same-size perturbation, but the cloud barely moves and the refusal rate stays high — the effect was about which direction, not how big.",
      },
      {
        label: "Inject refusal into benign prompts",
        do: "Set Arm = Induce. Watch five harmless-but-scary-looking requests slide from full help to refused as the added direction pushes them past θ.",
      },
      {
        label: "Find the instrument's floor",
        do: "Drag θ up past the harmful cloud. Baseline refusal falls to near zero and there is nothing left to suppress — the same NO-BASELINE-REFUSAL outcome the real Gemma run hit.",
      },
    ],
    post: "/posts/05-h005-refusal-direction/",
    sim: () => import("./refusal_sim.mjs"),
    widget: () => import("./refusal_widget.mjs"),
  },
];

export function getSimulation(id) {
  return SIMULATIONS.find((s) => s.id === id) || null;
}
