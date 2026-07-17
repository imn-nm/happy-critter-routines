// Minimal voxel model format shared by the voxel critter collection.
// Coordinates: x = width (left→right), y = height (up), z = depth (toward viewer).
// The renderer assumes an isometric camera looking at the +x/+y/+z faces.

export interface Voxel {
  x: number;
  y: number;
  z: number;
  c: string; // hex color
}

export interface VoxelModel {
  id: string;
  name: string;
  description: string;
  voxels: Voxel[];
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Small mutable builder so characters can be described as boxes plus
 * "paint" touch-ups. Later writes to the same cell overwrite earlier ones,
 * which is how faces, bellies and markings are layered onto the base shape.
 */
export class VoxelBuilder {
  private cells = new Map<string, Voxel>();

  set(x: number, y: number, z: number, c: string) {
    this.cells.set(key(x, y, z), { x, y, z, c });
    return this;
  }

  /** Filled axis-aligned box, inclusive on both corners. */
  box(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, c: string) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
          this.set(x, y, z, c);
    return this;
  }

  /** Recolor the front-most (max z) voxel in a column — used to paint faces. */
  paintFront(x: number, y: number, c: string) {
    let front: Voxel | undefined;
    for (const v of this.cells.values()) {
      if (v.x === x && v.y === y && (!front || v.z > front.z)) front = v;
    }
    if (front) this.set(front.x, front.y, front.z, c);
    return this;
  }

  build(id: string, name: string, description: string): VoxelModel {
    return { id, name, description, voxels: [...this.cells.values()] };
  }
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color; amt in [-1, 1]. */
export const shade = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const target = amt >= 0 ? 255 : 0;
    const mixed = Math.round(v + (target - v) * Math.abs(amt));
    return Math.max(0, Math.min(255, mixed));
  };
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};
