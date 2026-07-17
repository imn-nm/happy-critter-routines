import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Voxel, VoxelModel, shade } from "./voxelModel";

interface VoxelSpriteProps {
  model: VoxelModel;
  size?: number;
  animated?: boolean;
  className?: string;
}

// Isometric projection: the camera sees the +x, +y and +z faces of each cube.
const project = (x: number, y: number, z: number): [number, number] => [
  x - z,
  (x + z) * 0.5 - y,
];

const toPoints = (corners: [number, number, number][]): string =>
  corners
    .map(([x, y, z]) => {
      const [px, py] = project(x, y, z);
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(" ");

interface Face {
  points: string;
  fill: string;
}

const buildFaces = (voxels: Voxel[]): { faces: Face[]; viewBox: string } => {
  const occupied = new Set(voxels.map((v) => `${v.x},${v.y},${v.z}`));
  const sorted = [...voxels].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));

  const faces: Face[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const track = (x: number, y: number, z: number) => {
    const [px, py] = project(x, y, z);
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  };

  for (const { x, y, z, c } of sorted) {
    // Track all 8 cube corners so the viewBox bounds the whole model.
    for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) track(x + dx, y + dy, z + dz);

    if (!occupied.has(`${x},${y + 1},${z}`)) {
      faces.push({
        fill: shade(c, 0.18),
        points: toPoints([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]),
      });
    }
    if (!occupied.has(`${x},${y},${z + 1}`)) {
      faces.push({
        fill: c,
        points: toPoints([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]),
      });
    }
    if (!occupied.has(`${x + 1},${y},${z}`)) {
      faces.push({
        fill: shade(c, -0.22),
        points: toPoints([[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]),
      });
    }
  }

  const pad = 0.5;
  const viewBox = `${(minX - pad).toFixed(2)} ${(minY - pad).toFixed(2)} ${(maxX - minX + pad * 2).toFixed(2)} ${(maxY - minY + pad * 2).toFixed(2)}`;
  return { faces, viewBox };
};

/** Renders a voxel model as a lightweight isometric SVG sprite. */
const VoxelSprite = ({ model, size = 160, animated = false, className }: VoxelSpriteProps) => {
  const { faces, viewBox } = useMemo(() => buildFaces(model.voxels), [model]);

  return (
    <div className={cn("inline-block", className)} style={{ width: size, height: size }}>
      {animated && (
        <style>{`
          @keyframes voxel-idle-bob {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-3%) scale(1.015); }
          }
          .voxel-idle-bob { animation: voxel-idle-bob 2.4s ease-in-out infinite; transform-origin: center bottom; }
          @media (prefers-reduced-motion: reduce) {
            .voxel-idle-bob { animation: none; }
          }
        `}</style>
      )}
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={model.name}
        className={animated ? "voxel-idle-bob" : undefined}
        style={{ width: "100%", height: "100%" }}
      >
        {faces.map((f, i) => (
          // Stroke matches the fill to hide antialiasing seams between faces.
          <polygon key={i} points={f.points} fill={f.fill} stroke={f.fill} strokeWidth={0.04} strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
};

export default VoxelSprite;
