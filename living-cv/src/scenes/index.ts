import type { SceneCtor } from '../core/chapter';
import type { SceneKey } from '../content/types';
import { HeroScene } from './hero';
import { BridgeScene } from './bridge';
import { NeuroScene } from './neuro';
import { VoiceScene } from './voice';
import { BuildingScene } from './building';
import { ObserveScene } from './observe';
import { PostTrainScene } from './posttrain';
import { ModelsScene } from './models';

/** Content names a scene by key; this is the only place keys meet classes. */
export const SCENES: Record<SceneKey, SceneCtor> = {
  hero: HeroScene,
  bridge: BridgeScene,
  neuro: NeuroScene,
  voice: VoiceScene,
  building: BuildingScene,
  observe: ObserveScene,
  posttrain: PostTrainScene,
  models: ModelsScene,
};
