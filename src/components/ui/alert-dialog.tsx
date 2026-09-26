import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { AnimatePresence, motion } from "motion/react"
import { closeButtonClass, closeIconClass, scrimClass } from "@/lib/focusStyles"
import { cardMotion, overlayMotion, useMotionPrefs } from "@/lib/motion"

/**
 * Confirmation cards, animated with Motion for React: the scrim fades in and
 * the card scales up in the middle of the screen. Open state is mirrored into
 * context so the portal can stay mounted for the exit animation.
 */
type AlertDialogState = { open: boolean }
const AlertDialogStateContext = React.createContext<AlertDialogState>({ open: false })

const AlertDialog = ({ open: openProp, defaultOpen, onOpenChange, ...props }: AlertDialogPrimitive.AlertDialogProps) => {
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
  const state = React.useMemo(() => ({ open }), [open])
  return (
    <AlertDialogStateContext.Provider value={state}>
      <AlertDialogPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </AlertDialogStateContext.Provider>
  )
}

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const { t } = useMotionPrefs()
  return (
    <AlertDialogPrimitive.Overlay ref={ref} asChild forceMount {...props}>
      <motion.div
        className={cn("fixed inset-0 z-50", scrimClass, className)}
        initial={overlayMotion.initial}
        animate={overlayMotion.animate}
        exit={overlayMotion.exit}
        transition={t(overlayMotion.transition)}
      />
    </AlertDialogPrimitive.Overlay>
  )
})
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(AlertDialogStateContext)
  const { t } = useMotionPrefs()
  return (
    <AnimatePresence>
      {open && (
        <AlertDialogPortal forceMount>
          <AlertDialogOverlay />
          <AlertDialogPrimitive.Content ref={ref} asChild forceMount {...props}>
            <motion.div
              className={cn(
                // Centred Focus card. Motion owns the transform, so the
                // -50% centring offset is set through `style`, not classes.
                "fixed left-1/2 top-1/2 z-50 flex flex-col bg-focus-sheet text-focus-text shadow-sh-lg rounded-[28px] overflow-hidden outline-none",
                "w-[calc(100vw-2.5rem)] max-w-lg max-h-[calc(100dvh-2.5rem)]",
                className
              )}
              style={{ x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={t(cardMotion.transition)}
            >
              <div className="overflow-y-auto p-5 sm:p-6 grid gap-4">
                {children}
              </div>
              <AlertDialogPrimitive.Cancel asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className={cn("absolute right-3 top-3 z-10", closeButtonClass)}
                >
                  <X className={closeIconClass} />
                  <span className="sr-only">Close</span>
                </button>
              </AlertDialogPrimitive.Cancel>
            </motion.div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPortal>
      )}
    </AnimatePresence>
  )
})
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-20 font-semibold leading-tight text-focus-text pr-10", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-14 text-focus-muted", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
