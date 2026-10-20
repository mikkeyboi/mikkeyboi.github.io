import type { ChapterContent } from './types';
import { REFS } from './refs';
import { siteUrl } from '../core/site';

/**
 * The journey, in order. Each chapter is a scene key plus the words around it:
 * caption beats (what the reader is told) and notes pinned to the visual (detail + reference).
 */
export const CHAPTERS: ChapterContent[] = [
  {
    id: 'top',
    scene: 'hero',
    length: 1.9,
    beats: [],
  },
  {
    id: 'bridge',
    scene: 'bridge',
    rail: 'The bridge',
    length: 4.4,
    speedHint: true,
    legend: [{ label: 'Research', hue: 'copper' }, { label: 'Reliable systems', hue: 'teal' }, { label: 'Observability', hue: 'violet' }],
    beats: [
      { from: 0, to: 0.22, kicker: 'The through-line', title: 'Research lives at the edge.', body: ['New models, rewards and agents are noisy, fast and unproven.'] },
      { from: 0.22, to: 0.46, title: 'Operations live on certainty.', body: ['Critical paths hold a 99.9% SLO across paired regions, with business continuity rehearsed, not assumed.'] },
      { from: 0.46, to: 0.68, title: 'Every request, observed.', body: ['Traces, latency, tokens and tool calls on every path, so nothing ships blind.'] },
      { from: 0.68, to: 1.01, title: 'I build the bridge.', body: ['Experiments earn their way across an evaluation gate into production, and the SLO never notices.'] },
    ],
    notes: [
      { anchor: 'slo', from: 0.3, to: 0.46, dx: -340, dy: -10, text: 'Watch the drill: the primary region steps aside, traffic fails over to its pair, and the SLI stays above the line.' },
      { anchor: 'traces', from: 0.52, to: 0.68, dx: -150, dy: -140, text: 'Each ring on a lane is a request being traced. The waterfall below is what an engineer opens when something looks off.' },
      { anchor: 'gate', from: 0.78, to: 1.01, dx: 24, dy: -175, text: 'Matching model strengths to the business goal, while keeping spend in check, is how research earns its place in production.', ref: REFS.insideTrack },
    ],
  },
  {
    id: 'neuro',
    scene: 'neuro',
    rail: 'Operating room',
    length: 8.4,
    speedHint: true,
    era: { start: 2017, end: 2021, role: 'Graduate Research Fellow · Neurosurgical methods', org: 'Ottawa Hospital Research Institute' },
    legend: [{ label: 'Clinical system, untouched', hue: 'teal' }, { label: 'Research platform', hue: 'copper' }],
    beats: [
      { from: 0, to: 0.1, kicker: '01 · Brain-computer interfaces', title: 'The operating room', body: ['An awake patient. A VR headset. A microelectrode descending toward a target smaller than a grain of rice.'] },
      { from: 0.1, to: 0.22, title: 'Listening to single neurons.', body: ["Deep brain stimulation for Parkinson's. The surgical system already strains to map the trajectory against MRI and CT."] },
      { from: 0.22, to: 0.35, title: 'Three clocks become one.', body: ['30 kHz from the brain, 120 Hz from the eyes, 1 kHz from the headset, aligned live on equipment that had no bandwidth to spare.'], stat: { value: '≈3.4B', label: 'samples an hour' } },
      { from: 0.35, to: 0.48, title: 'Stop.', body: ['A countermanding task: look to the target, unless told to stop. Stopping recruits the same pathways that fail in freezing of gait, and provokes bursts of beta.', 'Controlling the onset turns those bursts into clean, time-locked data for machine learning.'] },
      { from: 0.48, to: 0.6, title: 'A fingerprint of the disease.', body: ["The spectrum splits into an aperiodic 1/f background and periodic peaks. This patient's beta peak stands out."] },
      { from: 0.6, to: 0.73, title: 'Narrow beats broad.', body: ['Filtering all of 13–30 Hz collects noise that can cancel the signal. The patient-specific band FOOOF finds is narrower, and tracks motor deficits and their response to stimulation more closely.'] },
      { from: 0.73, to: 0.86, title: 'Research that helps the procedure.', body: ['The profile informs how stimulation is tuned. Research advanced, patients benefited, and the clinical core was never touched.'] },
      { from: 0.86, to: 1.01, kicker: 'Ottawa Hospital Research Institute · 2017–2021', title: 'Bleeding-edge, operating-room safe.' },
    ],
    notes: [
      { anchor: 'trajectory', from: 0.13, to: 0.22, at: { x: 0.5, y: 0 }, text: 'Surgical navigation keeps priority on the equipment. The research platform taps the same signals with an optimized bandwidth budget, so mapping never slows down.' },
      { anchor: 'eye', from: 0.38, to: 0.48, at: { x: 0, y: 0 }, text: "Countermanding saccades: failed stops reveal the impaired inhibition of Parkinson's disease, and the provoked beta bursts mark when the pathway engages.", ref: REFS.dissertation },
      { anchor: 'peak', from: 0.52, to: 0.6, at: { x: 0.47, y: 0.8 }, text: 'This spectrum is simulated and fit live: a synthetic recording, its Welch spectrum, and a FOOOF-style aperiodic fit, all computed in your browser.' },
      { anchor: 'band', from: 0.63, to: 0.73, at: { x: 0, y: 0 }, text: "FOOOF separates the aperiodic background from periodic peaks, so beta is measured against this patient's own spectrum and band.", ref: REFS.dissertation },
      { anchor: 'tip', from: 0.78, to: 1.01, at: { x: 0.47, y: 0.8 }, text: 'A filter fit to the patient is a biomarker of the patient. The same idea later shaped how I read features inside transformers.', ref: REFS.bciFilters },
    ],
  },
  {
    id: 'voice',
    scene: 'voice',
    rail: 'A million voices',
    length: 5.6,
    era: { start: 2021, end: 2023, role: 'Software Engineer', org: 'Microsoft' },
    legend: [{ label: 'Unsafe verbatim', hue: 'red' }, { label: 'Grounded theme', hue: 'teal' }],
    beats: [
      { from: 0, to: 0.22, kicker: '02 · Feedback intelligence · Microsoft 365', title: 'A million voices', body: ['Feedback pours in from every Microsoft 365 product, faster than any team could ever read it.'] },
      { from: 0.22, to: 0.42, title: 'Not all of it is kind.', body: ["Raw verbatims can be vulgar or unreadable. Researchers shouldn't have to wade through that to find the signal."] },
      { from: 0.42, to: 0.68, title: 'Noise becomes themes.', body: ['Scalable pipelines synthesize what people are actually saying, and every theme stays grounded in real verbatims without introducing bias.'] },
      { from: 0.68, to: 1.01, title: 'Hypotheses, tested on demand.', body: ['UI and UX teams validate an idea against the voice of their users, and product teams get recommendations they can act on.'] },
    ],
  },
  {
    id: 'building',
    scene: 'building',
    rail: 'Living buildings',
    length: 4.4,
    era: { start: 2024, end: 2025, role: 'ML Engineer', org: 'Microsoft' },
    legend: [{ label: 'Telemetry', hue: 'teal' }, { label: 'Alarm', hue: 'red' }],
    beats: [
      { from: 0, to: 0.24, kicker: '03 · Smart buildings · Microsoft Digital', title: 'Buildings that think', body: ['Thousands of sensors per building. Air, temperature, pressure, power, every few seconds.'] },
      { from: 0.24, to: 0.48, title: 'A river of telemetry.', body: ['And somewhere in it, the alarm that matters, in a research lab that cannot wait.'] },
      { from: 0.48, to: 0.84, title: 'Agents that work the problem.', body: ['Multi-agent orchestration routes, diagnoses and hands operators and technicians what they need, in near real time.'] },
      { from: 0.84, to: 1.01, title: 'Resolved before anyone asks.', body: ['But how do you trust a swarm of agents with a building that must stay at 99.9%?'] },
    ],
  },
  {
    id: 'observe',
    scene: 'observe',
    length: 6.4,
    era: { start: 2026, role: 'Senior Software Engineer', org: 'Microsoft' },
    legend: [{ label: 'Inference', hue: 'violet' }, { label: 'Tool call', hue: 'sky' }, { label: 'Handoff', hue: 'teal' }],
    beats: [
      { from: 0, to: 0.28, kicker: '03 · Observability & evaluation', title: 'Every decision leaves a trace.', body: ['Each turn, tool call and handoff is a span with its latency, tokens and outcome.'] },
      { from: 0.28, to: 0.5, title: 'Zoom out: a swarm.', body: ['The same lens shows agents working together, so engineers see where time, tokens and errors really go.'] },
      { from: 0.5, to: 0.7, title: 'Zoom out again: the gates.', body: ['Business-critical scenarios score every ring, from pull request to canary to live.'] },
      { from: 0.7, to: 1.01, title: 'Regressions, named.', body: ['Metrics publish with every change and over time, and each regression is traced to data or to code before it reaches an operator.'] },
    ],
    notes: [
      { anchor: 'span', from: 0.1, to: 0.28, at: { x: 0.52, y: 0.74 }, text: 'Open any answer and drill down to the exact call behind it: the turn, the tool, the latency, the tokens.' },
      { anchor: 'gates', from: 0.58, to: 0.7, at: { x: 0.36, y: 0.0 }, text: 'The same suite runs at every ring, so evidence for promotion and evidence of a regression come from one place.' },
      { anchor: 'regression', from: 0.8, to: 1.01, at: { x: 0.03, y: 0.74 }, text: 'When a stronger general model regressed, traces localized it to equipment-vocabulary confusion. Those labeled failures set up the post-training that follows.', ref: REFS.sftGrpo },
    ],
  },
  {
    id: 'posttrain',
    scene: 'posttrain',
    length: 6.4,
    era: { start: 2026, role: 'AI/ML Engineering Senior Lead', org: 'Microsoft' },
    legend: [{ label: 'Generic model', hue: 'red' }, { label: 'Post-trained specialist', hue: 'teal' }],
    beats: [
      { from: 0, to: 0.22, kicker: '03 · Post-training for smarter, safer agents', title: 'Every building speaks a dialect.', body: ['Proprietary building-management tags pack location, equipment and action into a few characters.'] },
      { from: 0.22, to: 0.46, title: 'Powerful models still guess.', body: ['A generic model reads a physical restart as a harmless reset, and a 9 that means 90% as 9%.'] },
      { from: 0.46, to: 0.7, title: 'So I taught the rules.', body: ['Simulated scenarios from real data. SFT for the words, GRPO rewarded by the evaluation suite for the rules, RLCD for calibrated decisions.'] },
      { from: 0.7, to: 0.86, title: 'Now it knows what is dangerous.', body: ['It names the equipment, applies the severity, asks before acting, and gets there with fewer tool calls and tokens.'] },
      { from: 0.86, to: 1.01, title: 'Swarms, operating on their own.', body: ['Across the campus, agents act autonomously, with the confidence that observability and evaluation earned.'] },
    ],
    notes: [
      { anchor: 'tag', from: 0.1, to: 0.22, dx: -260, dy: 90, text: 'Illustrative tag. Real dialects vary by vendor and site, and general knowledge alone does not decode them.' },
      { anchor: 'pipeline', from: 0.58, to: 0.7, at: { x: 0.02, y: 0.33 }, text: 'On held-out scenarios, SFT + GRPO reached 83.3% against 67.8% for SFT alone, and refusing made-up tags rose from 60% to 86.7%.', ref: REFS.sftGrpo },
      { anchor: 'trained', from: 0.76, to: 0.86, at: { x: 0.5, y: 0.66 }, text: 'RLCD, reinforcement learning for calibrated decisions, routes each request to act, ask or escalate, which cut cost on near-real-time alarms.' },
    ],
  },
  {
    id: 'models',
    scene: 'models',
    rail: 'Inside models',
    length: 6,
    legend: [{ label: 'Benign', hue: 'teal' }, { label: 'Harmful', hue: 'red' }, { label: 'Refusal direction', hue: 'copper' }],
    beats: [
      { from: 0, to: 0.17, kicker: '04 · Interpretability', title: 'Inside a model, ideas are places.', body: ["Every prompt becomes a point in the model's activation space. Harmful requests and benign ones gather in different regions."] },
      { from: 0.17, to: 0.34, title: 'Find the direction.', body: ['The difference between their averages is one direction. Past a threshold along it, the model refuses.'] },
      { from: 0.34, to: 0.5, title: 'Why harmless prompts get close.', body: ['Words like kill, crack or combine look like harmful requests, so these prompts land near the threshold. A small nudge tips them into refusal. That is over-refusal.'] },
      { from: 0.5, to: 0.76, title: 'Push along it.', body: ['Add the direction and harmless requests start getting hedged, then refused. Remove it and refusals fall away. Try the slider.'] },
      { from: 0.76, to: 1.01, title: 'Not just any direction.', body: ['The same-size push along a random direction barely changes anything. That control is what makes the finding mean something.'], link: { label: 'Open the playground', url: siteUrl('/playground/') } },
    ],
    notes: [
      { anchor: 'direction', from: 0.22, to: 0.34, at: { x: 0.56, y: 0.12 }, text: 'Where you look matters: a probe can read a concept at layers where steering it does little, and the reverse.', ref: REFS.readableSteerable },
      { anchor: 'rate', from: 0.84, to: 1.01, at: { x: 0.02, y: 0.86 }, text: 'A controlled reproduction of single-direction refusal on a 1.5B chat model, with norm-matched random baselines.', ref: REFS.refusal },
    ],
  },
];
