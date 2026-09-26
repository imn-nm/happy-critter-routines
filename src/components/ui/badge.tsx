import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-12 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-focus-lavender focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-focus-lavender text-focus-bg",
        secondary:
          "border-transparent bg-focus-raised text-focus-muted",
        destructive:
          "border-transparent bg-focus-coral text-focus-bg",
        outline: "border-focus-raised text-focus-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
