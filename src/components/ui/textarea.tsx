import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full resize-none rounded-[14px] border border-focus-raised bg-focus-surface px-4 py-3 text-[16px] sm:text-[15px] text-focus-text ring-offset-focus-bg placeholder:text-focus-muted/70 focus-visible:outline-none focus-visible:border-focus-lavender focus-visible:ring-2 focus-visible:ring-focus-lavender focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
