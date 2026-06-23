// refusal_widget.mjs — shared, self-contained UI factory for the H005 refusal toy.
//
// Single source of truth for the interactive widget used BOTH in the blog post
// (posts/05-h005-refusal-direction) and on the /playground page. The math lives
// in refusal_sim.mjs (Node-tested); this file is pure presentation.
//
// Dependency-injected on purpose: it imports nothing, so it has no path coupling
// and can be mounted from any page. The caller passes Observable's runtime helpers
// (Inputs, Plot, html) and the already-loaded sim module:
//
//   import { renderRefusalToy } from "/playground/widgets/refusal_widget.mjs";
//   renderRefusalToy(container, { Inputs, Plot, html, sim });
//
// Reactivity is manual (Observable Inputs emit "input" events and expose .value),
// which is what lets the playground mount/unmount widgets on a dropdown — a thing
// Quarto's `viewof` cells cannot do.

// Badge colours per help tier, light + dark. [label, fg, bg] each mode.
const TIER_BADGE = {
  full: { label: "full help", light: ["#1a7f37", "#dafbe1"], dark: ["#7ee2a8", "#13321f"] },
  hedged: { label: "hedged", light: ["#9a6700", "#fff8c5"], dark: ["#e8c45a", "#3a2f0a"] },
  refused: { label: "refused", light: ["#cf222e", "#ffebe9"], dark: ["#ff8a8a", "#3a1416"] },
};

// Plot palette per mode — the histogram fills, the theta rule, axis text.
const PLOTS = {
  light: { before: "#9ec1e8", after: "#0550ae", rule: "#b54708", text: "#1f2328", axis: "#59636e" },
  dark: { before: "#3b6ea5", after: "#79b1ff", rule: "#f0883e", text: "#e6edf3", axis: "#9198a1" },
};

// True when Quarto's dark toggle is active (it sets .quarto-dark on <html>/<body>).
function isDark() {
  return document.documentElement.classList.contains("quarto-dark") ||
    document.body.classList.contains("quarto-dark");
}

export function renderRefusalToy(container, { Inputs, Plot, html, sim, defaults = {} }) {
  container.innerHTML = "";
  container.classList.add("sim-widget");

  // --- Controls (Observable Inputs are DOM nodes with .value + "input" events) ---
  const armInput = Inputs.radio(
    new Map([
      ["Suppress (ablate, harmful set)", "suppress"],
      ["Induce (add, harmless set)", "induce"],
    ]),
    { label: "Arm", value: defaults.arm ?? "suppress" }
  );
  const dirInput = Inputs.radio(
    new Map([
      ["Fitted refusal direction", "fitted"],
      ["Norm-matched random control", "control"],
    ]),
    { label: "Direction", value: defaults.direction ?? "fitted" }
  );
  const doseInput = Inputs.range([0, 2], { step: 0.1, value: defaults.doseScale ?? 1, label: "Addition dose (induce arm)" });
  const thetaInput = Inputs.range([-2, 6], { step: 0.25, value: defaults.theta ?? 1.5, label: "Refusal threshold θ" });
  const seedInput = Inputs.range([0, 9], { step: 1, value: defaults.seed ?? 0, label: "Seed (resample + refit)" });

  const controls = html`<div class="sim-widget-controls">${armInput}${dirInput}${doseInput}${thetaInput}${seedInput}</div>`;
  const output = html`<div class="sim-widget-output"></div>`;
  container.append(controls, output);

  const badge = (tier) => {
    const t = TIER_BADGE[tier];
    const [fg, bg] = isDark() ? t.dark : t.light;
    return html`<span style="display:inline-block;padding:0.1em 0.6em;border-radius:999px;font-size:0.8em;font-weight:600;color:${fg};background:${bg};white-space:nowrap">${t.label}</span>`;
  };

  function renderOutput() {
    const arm = armInput.value;
    const dir = dirInput.value;
    const toy = sim.simulate({
      arm,
      direction: dir,
      doseScale: doseInput.value,
      theta: thetaInput.value,
      seed: seedInput.value,
    });

    // Tidy long-format so the color scale maps fill = phase (bare number arrays
    // with fill:"before" paint transparent — Plot reads it as a missing field).
    const hist = [
      ...toy.projBefore.map((v) => ({ v, phase: "before" })),
      ...toy.projAfter.map((v) => ({ v, phase: "after" })),
    ];

    const pal = isDark() ? PLOTS.dark : PLOTS.light;
    const plot = Plot.plot({
      height: 260,
      marginLeft: 50,
      marginTop: 28,
      style: { background: "transparent", color: pal.axis },
      x: { label: "projection onto the refusal axis →", grid: true },
      y: { label: "count" },
      color: { legend: true, domain: ["before", "after"], range: [pal.before, pal.after] },
      marks: [
        Plot.rectY(hist, Plot.binX({ y: "count" }, { x: "v", fill: "phase", fillOpacity: 0.6, thresholds: 36 })),
        Plot.ruleX([toy.theta], { stroke: pal.rule, strokeDasharray: "4 3", strokeWidth: 1.5 }),
        Plot.text([{ x: toy.theta }], { x: "x", text: ["θ — refuse →"], dy: -14, dx: 5, fill: pal.rule, textAnchor: "start", frameAnchor: "top" }),
        Plot.ruleY([0]),
      ],
    });

    const setLabel = arm === "suppress" ? "(harmful set)" : "(harmless set)";
    const verb = arm === "suppress" ? "ablating" : "adding";
    const dirLabel = dir === "fitted" ? "fitted refusal direction" : "random control";
    const tail =
      dir === "control"
        ? " The control barely moves the cloud — the perturbation is the same size, only the direction differs."
        : arm === "suppress"
          ? " Erasing the one direction drops the refusal."
          : " Injecting it raises refusal on prompts that were harmless.";
    const rate = html`<p class="sim-widget-rate"><strong>Refusal rate ${setLabel}: ${toy.rateBefore.toFixed(2)} → ${toy.rateAfter.toFixed(2)}</strong> after ${verb} the ${dirLabel}. Difference-of-means recovered the planted axis at cosine ${toy.cosine.toFixed(3)}.${tail}</p>`;

    const tableIntro = html`<p class="sim-widget-note">Five <strong>benign</strong> requests that merely <em>look</em> risky — the over-refusal regime, where a safe prompt resembles a harmful one. Watch the same request slide between <strong>full help</strong>, a <strong>hedged</strong> partial answer, and a <strong>refusal</strong> as ${arm === "suppress" ? "ablation pulls its activation below θ" : "the added direction pushes its activation past θ"}. The decision is still exactly <em>projection > θ</em>; how <em>much</em> help it gets is graded by how far it sits from the line.</p>`;

    const table = html`<table class="toy-examples">
      <thead><tr><th>benign request</th><th>before</th><th>after</th><th>model response (after)</th></tr></thead>
      <tbody>${toy.examples.map(
        (e) => html`<tr>
          <td>${e.prompt}</td>
          <td>${badge(e.tier_before)}</td>
          <td>${badge(e.tier_after)}</td>
          <td class="toy-completion">${e.text_after}</td>
        </tr>`
      )}</tbody>
    </table>`;

    output.replaceChildren(plot, rate, tableIntro, table);
  }

  for (const inp of [armInput, dirInput, doseInput, thetaInput, seedInput]) {
    inp.addEventListener("input", renderOutput);
  }
  renderOutput();

  // Re-render when the user toggles dark mode (Quarto flips .quarto-dark on the
  // root), so the plot fills + badges pick up the new palette. Observe class
  // changes on <html> and <body>.
  const themeObserver = new MutationObserver(() => renderOutput());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  return { rerender: renderOutput };
}
