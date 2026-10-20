import type { Reference } from './types';
import { siteUrl } from '../core/site';

const BLOG = siteUrl('/posts');

/** Every public reference in one place, so a link changes once. */
export const REFS = {
  dissertation: { label: 'Dissertation · uOttawa, 2022', url: 'https://doi.org/10.20381/ruor-28479' },
  bciFilters: { label: 'Patient-specific filters as biomarkers', url: `${BLOG}/02-bci-spatial-filters/` },
  insideTrack: { label: 'Microsoft Inside Track, 2026', url: 'https://www.microsoft.com/insidetrack/blog/our-customer-zero-guide-enabling-agent-creation-across-microsoft-365-copilot-copilot-studio-and-foundry/' },
  sftGrpo: { label: 'Why SFT learned the words but GRPO learned the rules', url: `${BLOG}/01-sft-grpo-hvac/` },
  depthProfile: { label: 'A probe at layer 0 is a lie detector', url: `${BLOG}/04-h001-depth-profile/` },
  refusal: { label: 'Does a single direction mediate refusal?', url: `${BLOG}/05-h005-refusal-direction/` },
  readableSteerable: { label: 'Readable shallow, steerable deep', url: `${BLOG}/06-h004-readable-vs-steerable/` },
} satisfies Record<string, Reference>;
