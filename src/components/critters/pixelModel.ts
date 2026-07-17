// Flat 2D pixel-art character format: characters are drawn on a small grid
// (x = column left→right, y = row top→bottom) as chunky colored cells with
// no outlines, matching the app's soft blocky illustration style.

export interface PixelCell {
  x: number;
  y: number;
  c: string; // hex color
}

export interface PixelModel {
  id: string;
  name: string;
  description: string;
  cells: PixelCell[];
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

  build(id: string, name: string, description: string): PixelModel {
    return { id, name, description, cells: [...this.cells.values()] };
  }
}
