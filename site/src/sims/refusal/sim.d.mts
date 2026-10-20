// Types for sim.mjs, which stays plain JavaScript so it matches the Python reference line for line.

export type Arm = 'suppress' | 'induce';
export type Direction = 'fitted' | 'control';
export type Tier = 'full' | 'hedged' | 'refused';

export interface SimulateOptions { seed?: number; theta?: number; doseScale?: number; arm?: Arm; direction?: Direction; nPerClass?: number; d?: number }

export interface WorkedExample {
  prompt: string;
  proj_before: number;
  proj_after: number;
  refuses_before: boolean;
  refuses_after: boolean;
  tier_before: Tier;
  tier_after: Tier;
  help_before: number;
  help_after: number;
  text_before: string;
  text_after: string;
}

export interface Simulation {
  arm: Arm;
  direction: Direction;
  theta: number;
  doseScale: number;
  addCoeff: number;
  cosine: number;
  projBefore: number[];
  projAfter: number[];
  rateBefore: number;
  rateAfter: number;
  examples: WorkedExample[];
}

interface ConditionRates { baseline_harmful_refusal: number; ablation_harmful_refusal: number; addition_harmless_refusal: number }

export interface FitAndRun {
  cosine: number;
  theta: number;
  real: ConditionRates;
  control: ConditionRates;
  verdict: { verdict: string };
}

export function simulate(opts?: SimulateOptions): Simulation;
export function fitAndRun(opts?: { seed?: number; theta?: number; doseScale?: number; nPerClass?: number; d?: number }): FitAndRun;
