import type { Scene } from '../scene';

/** What a chapter knows on each frame, handed to every part of its stage. */
export interface ChapterFrame {
  /** Smoothed scroll progress (drives visuals) and raw progress (drives copy). */
  p: number;
  target: number;
  scene: Scene;
  chapterId: string;
}

/** One layer of a chapter's sticky stage: captions, notes, era timeline, legend, speed control. */
export interface StagePart {
  readonly el: HTMLElement;
  update?(frame: ChapterFrame): void;
}
