import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input — design-system styled text field.
 *   Pill radius, glass surface (white @ 6%), iris-400 @ 30% solid stroke,
 *   fog-50 text. Focus ring uses --ring (iris-400). Mirrors the look of
 *   Secondary buttons so forms feel consistent with the rest of the UI.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-pill border border-iris-400/30 bg-white/[0.04] px-4 text-14 text-fog-50",
          "ring-offset-background placeholder:text-fog-300",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
