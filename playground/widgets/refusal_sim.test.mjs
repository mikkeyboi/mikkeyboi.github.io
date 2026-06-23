// refusal_sim.test.mjs — Node regression test for the H005 interactive sim math.
//
// Run:  node posts/05-h005-refusal-direction/refusal_sim.test.mjs
//
// Guards the JS port against drift from the committed Python artifacts: the
// planted-model reproduction must keep its signature (diff-of-means recovers the
// planted axis; ablating the fitted direction suppresses refusal and adding it
// induces refusal; a norm-matched random control does NEITHER), and the
// simulate() UI entry must behave correctly across every arm x direction.
//
// No deps beyond Node. Exits non-zero on any failure.

import {
  fitAndRun,
  simulate,
  diffOfMeans,
  makePlantedDataset,
  cosine,
  mulberry32,
} from "./refusal_sim.mjs";

let pass = 0;
let fail = 0;
function check(name, cond, got) {
  if (cond) pass++;
  else fail++;
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${name}  ${got ?? ""}`);
}

console.log("== planted-model reproduction (matches committed h005_refusal_planted_demo.json) ==");
const r = fitAndRun({ seed: 0 });
check("diff-of-means recovers r_hat (cosine > 0.95)", r.cosine > 0.95, `cosine=${r.cosine.toFixed(4)}`);
check("baseline harmful refusal ~1", r.real.baseline_harmful_refusal >= 0.9, r.real.baseline_harmful_refusal);
check("ablation (real) -> ~0", r.real.ablation_harmful_refusal <= 0.1, r.real.ablation_harmful_refusal);
check("ablation (control) stays high", r.control.ablation_harmful_refusal >= 0.9, r.control.ablation_harmful_refusal);
check("addition (real) -> ~1", r.real.addition_harmless_refusal >= 0.9, r.real.addition_harmless_refusal);
check("addition (control) stays low", r.control.addition_harmless_refusal <= 0.1, r.control.addition_harmless_refusal);
check("verdict SINGLE-DIRECTION-REPRODUCES", r.verdict.verdict === "SINGLE-DIRECTION-REPRODUCES", r.verdict.verdict);

console.log("== instrument floor: theta past the harmful cloud -> NO-BASELINE-REFUSAL ==");
const hi = fitAndRun({ seed: 0, theta: 6.0 });
check("NO-BASELINE-REFUSAL at high theta", hi.verdict.verdict === "NO-BASELINE-REFUSAL", hi.verdict.verdict);

console.log("== simulate() UI entry: four arm x direction combinations ==");
const sf = simulate({ arm: "suppress", direction: "fitted" });
check("suppress+fitted collapses", sf.rateBefore >= 0.9 && sf.rateAfter <= 0.1, `${sf.rateBefore}->${sf.rateAfter}`);
const sc = simulate({ arm: "suppress", direction: "control" });
check("suppress+control does not suppress", sc.rateAfter >= 0.9, sc.rateAfter);
const inf = simulate({ arm: "induce", direction: "fitted" });
check("induce+fitted induces", inf.rateBefore <= 0.1 && inf.rateAfter >= 0.9, `${inf.rateBefore}->${inf.rateAfter}`);
const inc = simulate({ arm: "induce", direction: "control" });
check("induce+control does not induce", inc.rateAfter <= 0.1, inc.rateAfter);

console.log("== dose monotonicity (induce, fitted) ==");
const doses = [0, 0.5, 1.0, 1.5].map((ds) => simulate({ arm: "induce", direction: "fitted", doseScale: ds }).rateAfter);
check("induce rate non-decreasing in dose", doses.every((v, i) => i === 0 || v >= doses[i - 1] - 1e-9), JSON.stringify(doses));

console.log("== projection clouds move (fitted) / stay (control) under suppression ==");
const below = sf.projAfter.filter((p) => p <= sf.theta).length / sf.projAfter.length;
check("fitted: after-cloud below theta", below >= 0.9, below.toFixed(3));
const belowC = sc.projAfter.filter((p) => p <= sc.theta).length / sc.projAfter.length;
check("control: after-cloud still above theta", belowC <= 0.1, belowC.toFixed(3));

console.log("== seed stability ==");
for (const s of [1, 7, 13]) {
  const rr = fitAndRun({ seed: s });
  check(`seed ${s} reproduces`, rr.verdict.verdict === "SINGLE-DIRECTION-REPRODUCES", rr.verdict.verdict);
}

console.log("== graded worked examples (degree of help vs theta) ==");
const ind = simulate({ arm: "induce", direction: "fitted", doseScale: 1.0 });
check("examples carry a prompt + graded tiers", ind.examples.length === 5 &&
  typeof ind.examples[0].prompt === "string" &&
  ["full", "hedged", "refused"].includes(ind.examples[0].tier_after), ind.examples[0].tier_after);
check("induce+fitted: benign prompts start as full help",
  ind.examples.every((e) => e.tier_before === "full"),
  ind.examples.map((e) => e.tier_before).join(","));
check("induce+fitted: after injection, every benign prompt is refused",
  ind.examples.every((e) => e.tier_after === "refused"),
  ind.examples.map((e) => e.tier_after).join(","));
// help score must be non-increasing as the direction is added (help <= before)
check("induce: help does not increase after adding the direction",
  ind.examples.every((e) => e.help_after <= e.help_before), "ok");
// the hedged tier must be reachable somewhere across the dose sweep (a real gradient)
const tiersSeen = new Set();
for (const ds of [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0, 1.4]) {
  for (const e of simulate({ arm: "induce", direction: "fitted", doseScale: ds }).examples) tiersSeen.add(e.tier_after);
}
check("all three help tiers (full/hedged/refused) appear across the dose sweep",
  ["full", "hedged", "refused"].every((t) => tiersSeen.has(t)), [...tiersSeen].join(","));
// suppress+fitted: harmful-cloud points start refused, ablation restores help
const sup = simulate({ arm: "suppress", direction: "fitted" });
check("suppress+fitted: benign prompts start refused, end as full help",
  sup.examples.every((e) => e.tier_before === "refused") && sup.examples.every((e) => e.tier_after === "full"),
  `${sup.examples[0].tier_before}->${sup.examples[0].tier_after}`);
// control must NOT change the help tier (it doesn't move the cloud)
const indC = simulate({ arm: "induce", direction: "control", doseScale: 1.0 });
check("induce+control: help tier unchanged (control is inert)",
  indC.examples.every((e) => e.tier_after === e.tier_before), "ok");

console.log(`\n== ${pass} passed, ${fail} failed ==`);
process.exit(fail === 0 ? 0 : 1);
