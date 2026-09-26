import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-[14px] text-14 font-semibold text-focus-muted ring-offset-focus-bg transition-colors hover:bg-focus-surface hover:text-focus-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-focus-lavender data-[state=on]:text-focus-bg",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-focus-raised bg-transparent hover:bg-focus-surface hover:text-focus-text",
      },
      size: {
        default: "h-11 px-3",
        sm: "h-11 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
