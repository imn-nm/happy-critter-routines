import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { scrimClass } from "@/lib/focusStyles"
import { overlayMotion, popoverMotion, useMotionPrefs } from "@/lib/motion"

/**
 * Anchored panels (the Rewards panel, time / date / icon pickers) animate
 * with Motion for React: the scrim fades in and the panel grows from the
 * trigger. Open state is mirrored into context so the portals stay mounted
 * for the exit animation.
 */
const PopoverOpenContext = React.createContext(false)

const Popover = ({ open: openProp, defaultOpen, onOpenChange, ...props }: PopoverPrimitive.PopoverProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const controlled = openProp !== undefined
  const open = controlled ? !!openProp : uncontrolledOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange],
  )
  return (
    <PopoverOpenContext.Provider value={open}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </PopoverOpenContext.Provider>
  )
}

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, children, ...props }, ref) => {
  const open = React.useContext(PopoverOpenContext)
  const { t } = useMotionPrefs()
  return (
    <AnimatePresence>
      {/* Backdrop behind the panel (Focus scrim), in its own portal: Radix
          portals take a single child. Tapping it is an outside tap, so it
          closes the popover. */}
      {open && (
        <PopoverPrimitive.Portal key="scrim" forceMount>
          <motion.div
            aria-hidden
            className={cn("fixed inset-0 z-50 pointer-events-auto", scrimClass)}
            initial={overlayMotion.initial}
            animate={overlayMotion.animate}
            exit={overlayMotion.exit}
            transition={t(overlayMotion.transition)}
          />
        </PopoverPrimitive.Portal>
      )}
      {open && (
        <PopoverPrimitive.Portal key="panel" forceMount>
          <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} asChild forceMount {...props}>
            <motion.div
              className={cn(
                "z-50 w-72 rounded-[24px] border border-focus-raised bg-focus-sheet p-4 text-focus-text shadow-sh-lg outline-none",
                className
              )}
              style={{ ...style, transformOrigin: "var(--radix-popover-content-transform-origin)" }}
              initial={popoverMotion.initial}
              animate={popoverMotion.animate}
              exit={popoverMotion.exit}
              transition={t(popoverMotion.transition)}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
