import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChipColor = "mint" | "iris" | "lilac" | "coral" | "amber";

interface BaseChipProps {
  children: ReactNode;
  className?: string;
}

interface OutlineChipProps extends BaseChipProps {
  variant?: "outline";
}

interface SolidChipProps extends BaseChipProps {
  variant: "solid";
  color?: ChipColor;
}

type ChipProps = OutlineChipProps | SolidChipProps;

/**
 * Chip — mirrors the Figma Chip component set (95:31).
 *
 *   Outline  → 50×28, no fill, iris-400 @ 30% stroke 2px,
 *              padding 6×12, gap 6, label fog-50 13 Bold (e.g. coin counter).
 *   Solid    → 56×26 (visual minimum), solid colour fill,
 *              padding 6×12, label fog-50 12 Medium.
 *
 * The container hugs its content, so the actual rendered width depends on
 * the children — these are minimum-style targets, not hard widths.
 */
export default function Chip(props: ChipProps) {
  if (props.variant === "solid") {
    const { color = "mint", children, className } = props;
    const fill = {
      mint:  "bg-mint-500",
      iris:  "bg-iris-400",
      lilac: "bg-lilac-400",
      coral: "bg-coral-500",
      amber: "bg-amber-500",
    }[color];
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-1.5 h-[26px] px-3 rounded-pill",
          fill,
          className,
        )}
      >
        <span className="text-12 font-medium text-fog-50 leading-none">
          {children}
        </span>
      </span>
    );
  }

  // Outline (default)
  const { children, className } = props;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-pill border-2 border-iris-400/30",
        className,
      )}
    >
      <span className="text-12 font-bold text-fog-50 leading-none">
        {children}
      </span>
    </span>
  );
}
