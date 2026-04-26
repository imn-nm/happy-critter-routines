import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button — mirrors the Figma "Button" component set.
 *
 * Figma axes:
 *   Style   = Primary | Secondary
 *   Size    = SM (36) | MD (44) | LG (56)
 *   Content = Text | IconText | IconOnly
 *
 * Visual rules:
 *   - Every variant is a pill (radius 999) with the aurora 1 px gradient stroke.
 *   - Primary   = ink-900 @ 72% fill, fog-50 label, dropshadow.
 *   - Secondary = iris-400 @ 4% fill, iris-300 label, no shadow.
 *   - Destructive / success / warning keep solid status fills for clarity
 *     and still wear the pill + stroke so they feel consistent.
 *   - ghost / link stay minimal (no stroke, no fill) for low-emphasis UI.
 */
const buttonVariants = cva(
  // Figma Button base: Inter Regular 14/16/18, pill radius. Stroke comes per-variant.
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-normal ring-offset-background transition-colors duration-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // ── Canonical Figma variants ───────────────────────────────
        // Primary: ink-900 @ 72% fill, vertical lilac gradient stroke, sh-md
        // shadow, fog-50 label.
        primary:
          "border-aurora bg-ink-900/70 text-fog-50 shadow-sh-md hover:bg-ink-900/60",
        // Secondary: iris-400 @ 4% fill, *solid* iris-400 @ 30% stroke, iris-300 label.
        secondary:
          "border border-iris-400/30 bg-iris-400/[0.04] text-iris-300 hover:bg-iris-400/[0.08] hover:text-iris-200",

        // ── Aliases mapped to Primary / Secondary ──────────────────
        default:
          "border-aurora bg-ink-900/70 text-fog-50 shadow-sh-md hover:bg-ink-900/60",
        outline:
          "border border-iris-400/30 bg-iris-400/[0.04] text-iris-300 hover:bg-iris-400/[0.08] hover:text-iris-200",
        accent:
          "border border-iris-400/30 bg-iris-400/[0.04] text-iris-300 hover:bg-iris-400/[0.08] hover:text-iris-200",

        // ── Status variants — solid fills, still pill + stroke ─────
        destructive:
          "border-aurora bg-coral-500 text-fog-50 hover:bg-coral-600",
        success:
          "border-aurora bg-mint-500 text-ink-900 hover:bg-mint-400",
        warning:
          "border-aurora bg-amber-500 text-ink-900 hover:bg-amber-400",

        // ── Low-emphasis ──────────────────────────────────────────
        ghost:
          "text-fog-50 hover:bg-white/[0.06]",
        link:
          "text-iris-300 underline-offset-4 hover:underline hover:text-iris-200",

        // ── Legacy gradient variants — kept so old call sites still work ─
        gradient:
          "border-aurora bg-gradient-to-br from-iris-500 to-lilac-500 text-fog-50",
        gradientSecondary:
          "border-aurora bg-gradient-to-br from-iris-600 to-iris-700 text-fog-50",
      },
      size: {
        // Figma sizes — text always Inter Regular (variant base sets font-normal)
        sm: "h-9  px-4 text-14 gap-2 [&_svg]:size-4",  // 36h, padX 16
        md: "h-11 px-5 text-16 gap-2 [&_svg]:size-5",  // 44h, padX 20
        lg: "h-14 px-6 text-18 gap-2 [&_svg]:size-6",  // 56h, padX 24

        // Icon-only squares
        "icon-sm": "h-9  w-9  [&_svg]:size-4",
        icon:      "h-11 w-11 [&_svg]:size-5",
        "icon-lg": "h-14 w-14 [&_svg]:size-6",

        // Aliases
        default: "h-11 px-5 text-16 gap-2 [&_svg]:size-5",        // → md
        xl:      "h-16 px-8 text-18 gap-2 [&_svg]:size-6",
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
