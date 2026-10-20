import type { Hue } from '../core/color';

export interface Reference {
  label: string;
  url: string;
}

/** One caption moment within a chapter, shown while progress is in [from, to). */
export interface Beat {
  from: number;
  to: number;
  kicker?: string;
  title: string;
  body?: string[];
  stat?: { value: string; label: string };
  link?: Reference;
}

/** A short detail pinned to a point on the visual, with an optional reference. */
export interface Note {
  anchor: string;
  from: number;
  to: number;
  text: string;
  ref?: Reference;
  /** Offset of the note's top-left corner from its anchor, in px (wide layout). */
  dx?: number;
  dy?: number;
  /** Or a fixed spot as fractions of the scene's drawing box (wide layout). */
  at?: { x: number; y: number };
}

/** Career stage when the chapter's work happened; shown as a soft-focus timeline. */
export interface Era {
  start: number;
  /** Omit for "present". */
  end?: number;
  role: string;
  org: string;
}

export type SceneKey = 'hero' | 'bridge' | 'neuro' | 'voice' | 'building' | 'observe' | 'posttrain' | 'models';

export interface ChapterContent {
  id: string;
  scene: SceneKey;
  /** Rail label; omit to keep the chapter off the rail. */
  rail?: string;
  /** Scroll length in viewport heights. */
  length: number;
  legend?: { label: string; hue: Hue }[];
  era?: Era;
  /** Show the "hover to speed up" hint on this chapter's visual. */
  speedHint?: boolean;
  beats: Beat[];
  notes?: Note[];
}

export interface Post {
  slug: string;
  tag: string;
  title: string;
  blurb: string;
  hue: Hue;
}
