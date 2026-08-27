// Flat 2D pixel-art character format: characters are drawn on a small grid
// (x = column left→right, y = row top→bottom) as chunky colored cells with
// no outlines, matching the app's soft blocky illustration style.

export interface PixelCell {
  x: number;
  y: number;
  c: string; // hex color
}

/** Inclusive grid box (both corners) marking cells that make up one eye. */
export interface EyeBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** How a rigged part moves for a given mood. */
export type PartMotionType = "none" | "swing" | "bob" | "sway" | "flop";

export interface PartMotion {
  type: PartMotionType;
  /** Degrees for swing; grid units for bob/sway. */
  amp: number;
  /** One full cycle, in seconds. */
  dur: number;
  /** Phase offset in seconds — use e.g. dur/2 to alternate opposite limbs. */
  delay?: number;
}

/**
 * A movable cluster of cells (head, arm, leg, tail…) that rotates about a
 * pivot (its joint) or translates, with a distinct motion per mood.
 */
export interface Part {
  name: string;
  /** Joint point in grid coordinates that swing rotates around. */
  pivot: { x: number; y: number };
  cells: { x: number; y: number }[];
  /** When true, the eye/blink group rides along inside this part. */
  holdsEyes?: boolean;
  /** Motion keyed by CritterMood; a missing mood means the part holds still. */
  motion?: Record<string, PartMotion>;
}

/**
 * A named alternate full-frame drawing. When a pose's name matches the current
 * mood, the sprite flips between the base drawing and this pose — a classic
 * 2-frame Tamagotchi animation — instead of using CSS transform motion.
 */
export interface Pose {
  name: string;
  cells: PixelCell[];
}

export interface PixelModel {
  id: string;
  name: string;
  description: string;
  cells: PixelCell[];
  /** Eye regions, so the sprite can blink these cells instead of bobbing. */
  eyes?: EyeBox[];
  /** Rigged parts for arm/leg/head motion; absent means a static sprite. */
  parts?: Part[];
  /** Hand-drawn alternate frames, keyed to moods by name (see Pose). */
  poses?: Pose[];
  /**
   * Opt into the lo-fi (Tamagotchi-style) reaction set: stepped low-framerate
   * body moods, ears that skew from their rooted base, and mood props (carrot,
   * z's, sparkles). Parts named "earL"/"earR" are driven as ears.
   */
  lofi?: boolean;
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Mutable builder so characters read as a list of shapes: rects for the big
 * masses, set() for single-cell details, erase() to notch corners so the
 * silhouette stays soft and hand-placed rather than boxy.
 */
export class PixelBuilder {
  private cells = new Map<string, PixelCell>();

  set(x: number, y: number, c: string) {
    this.cells.set(key(x, y), { x, y, c });
    return this;
  }

  /** Filled rectangle, inclusive on both corners. Later shapes overwrite earlier. */
  rect(x1: number, y1: number, x2: number, y2: number, c: string) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        this.set(x, y, c);
    return this;
  }

  erase(x1: number, y1: number, x2: number = x1, y2: number = y1) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        this.cells.delete(key(x, y));
    return this;
  }

  build(id: string, name: string, description: string, eyes?: EyeBox[]): PixelModel {
    return { id, name, description, cells: [...this.cells.values()], eyes };
  }
}
