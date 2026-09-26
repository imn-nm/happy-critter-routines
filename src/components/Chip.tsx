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
 *   Outline  → 50×28, no fill, focus-raised stroke 2px,
 *              padding 6×12, gap 6, label focus-text 12 Bold (e.g. coin counter).
 *   Solid    → 56×26 (visual minimum), solid colour fill,
 *              padding 6×12, label focus-bg 12 Semibold.
 *
 * The container hugs its content, so the actual rendered width depends on
 * the children — these are minimum-style targets, not hard widths.
 */
export default function Chip(props: ChipProps) {
  if (props.variant === "solid") {
    const { color = "mint", children, className } = props;
    const fill = {
      mint:  "bg-focus-mint",
      iris:  "bg-focus-iris",
      lilac: "bg-focus-lavender",
      coral: "bg-focus-coral",
      amber: "bg-focus-amber",
    }[color];
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-1.5 h-[26px] px-3 rounded-pill",
          fill,
          className,
        )}
      >
        <span className="text-12 font-semibold text-focus-bg leading-none">
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
        "inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-pill border-2 border-focus-raised",
        className,
      )}
    >
      <span className="text-12 font-bold text-focus-text leading-none">
        {children}
      </span>
    </span>
  );
}
