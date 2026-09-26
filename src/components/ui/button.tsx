import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button — Focus design system ("Focus — Components" in Figma).
 *
 * Visual rules:
 *   - Radius 14px, Semibold 14px label, every size is at least 44px tall
 *     (no tap targets under 44px).
 *   - default / primary = lime fill, navy label. Use for the ONE primary
 *     action on a screen.
 *   - secondary = focus-surface fill, muted label.
 *   - outline = transparent with a 1px raised border.
 *   - ghost = transparent, muted label, surface on hover.
 *   - destructive = coral.
 */
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-14 font-semibold ring-offset-focus-bg transition-colors duration-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Primary action — lime
        default: "bg-focus-lime text-focus-bg hover:bg-focus-lime/90",
        primary: "bg-focus-lime text-focus-bg hover:bg-focus-lime/90",
        // Secondary — surface
        secondary:
          "bg-focus-surface text-focus-muted hover:bg-focus-raised hover:text-focus-text",
        // Outline — transparent with a 1px border
        outline:
          "border border-focus-raised bg-transparent text-focus-text hover:border-focus-lavender hover:bg-focus-surface",
        accent:
          "border border-focus-lime bg-transparent text-focus-lime hover:bg-focus-lime/10",

        // Status
        destructive: "bg-focus-coral text-focus-bg hover:bg-focus-coral/90",
        success: "bg-focus-mint text-focus-bg hover:bg-focus-mint/90",
        warning: "bg-focus-amber text-focus-bg hover:bg-focus-amber/90",

        // Low emphasis
        ghost:
          "bg-transparent text-focus-muted hover:bg-focus-surface hover:text-focus-text",
        link: "text-focus-lavender underline-offset-4 hover:underline",

        // Legacy gradient variants — now flat so old call sites still work
        gradient: "bg-focus-lime text-focus-bg hover:bg-focus-lime/90",
        gradientSecondary:
          "bg-focus-surface text-focus-muted hover:bg-focus-raised hover:text-focus-text",
      },
      size: {
        sm: "min-h-11 h-11 px-4 [&_svg]:size-4",
        md: "h-11 px-5 [&_svg]:size-5",
        lg: "h-14 px-6 text-16 [&_svg]:size-6",

        // Icon-only squares — all at least 44×44
        "icon-sm": "h-11 w-11 [&_svg]:size-4",
        icon: "h-11 w-11 [&_svg]:size-5",
        "icon-lg": "h-14 w-14 [&_svg]:size-6",

        default: "h-11 px-5 [&_svg]:size-5",
        xl: "h-16 px-8 text-18 [&_svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
