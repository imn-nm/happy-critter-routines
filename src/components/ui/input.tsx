import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input — Focus design system text field.
 *   48px tall, radius 14, focus-surface fill, 1px focus-raised border,
 *   15px text, lavender focus ring.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[14px] border border-focus-raised bg-focus-surface px-4 text-[16px] sm:text-[15px] text-focus-text",
          "ring-offset-focus-bg placeholder:text-focus-muted/70",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:border-focus-lavender focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0",
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
