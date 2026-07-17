import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PixelModel } from "./pixelModel";

interface PixelSpriteProps {
  model: PixelModel;
  size?: number;
  animated?: boolean;
  className?: string;
}

/** Renders a flat pixel-art critter as a crisp SVG sprite. */
const PixelSprite = ({ model, size = 160, animated = false, className }: PixelSpriteProps) => {
  const { cells, viewBox } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of model.cells) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x + 1);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y + 1);
    }
    return {
      cells: model.cells,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    };
  }, [model]);

  return (
    <div className={cn("inline-block", className)} style={{ width: size, height: size }}>
      {animated && (
        <style>{`
          @keyframes critter-idle-bob {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-2.5%) scale(1.015); }
          }
          .critter-idle-bob { animation: critter-idle-bob 2.4s ease-in-out infinite; transform-origin: center bottom; }
          @media (prefers-reduced-motion: reduce) {
            .critter-idle-bob { animation: none; }
          }
        `}</style>
      )}
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={model.name}
        className={animated ? "critter-idle-bob" : undefined}
        style={{ width: "100%", height: "100%" }}
        shapeRendering="crispEdges"
        preserveAspectRatio="xMidYMax meet"
      >
        {cells.map((c, i) => (
          // Cells overdraw by a hair so antialiased seams never show between blocks.
          <rect key={i} x={c.x - 0.02} y={c.y - 0.02} width={1.04} height={1.04} fill={c.c} />
        ))}
      </svg>
    </div>
  );
};

export default PixelSprite;
