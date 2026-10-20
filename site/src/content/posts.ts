import type { Post } from './types';

/** Blog posts, newest first; each opens the conventional reading view on the blog. */
export const POSTS: Post[] = [
  { slug: '06-h004-readable-vs-steerable', tag: 'Interpretability', title: 'Readable shallow, steerable deep', blurb: 'The direction you can read a concept from is not the one that steers it, across three transformers.', hue: 'copper' },
  { slug: '05-h005-refusal-direction', tag: 'Safety', title: 'Does a single direction mediate refusal?', blurb: 'A small, controlled reproduction with norm-matched random baselines.', hue: 'red' },
  { slug: '04-h001-depth-profile', tag: 'Probing', title: 'A probe at layer 0 is a lie detector for your experiment', blurb: 'The number is not the finding; the shape of the curve is.', hue: 'teal' },
  { slug: '01-sft-grpo-hvac', tag: 'Post-training', title: 'Why SFT learned the words but GRPO learned the rules', blurb: 'Teaching a 14B model a proprietary building taxonomy with a hand-tuned reward.', hue: 'amber' },
  { slug: '03-cslt-seq2seq', tag: 'Seq2Seq', title: 'From consuming a pretrained model to training my own', blurb: 'A sign-language Copilot trained from scratch, with a hybrid runtime.', hue: 'violet' },
  { slug: '02-bci-spatial-filters', tag: 'Neuroscience', title: 'Patient-specific filters as biomarkers', blurb: 'ICA, FOOOF and CSP for noisy EEG, and what they taught me about transformers.', hue: 'sky' },
];
