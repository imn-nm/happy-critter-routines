import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { closeButtonClass, closeIconClass, scrimClass } from "@/lib/focusStyles"
import { overlayMotion, sheetMotion, useMotionPrefs } from "@/lib/motion"

/**
 * Dialogs render as the Figma bottom sheet, animated with Motion for React:
 * the scrim fades in, the sheet springs up from the bottom and slides back
 * down on close, and it can be pulled down by its grabber to dismiss.
 *
 * Radix owns focus, Escape and outside clicks; Motion owns the animation.
 * To let exit animations finish, the open state is mirrored into context so
 * DialogContent can mount its portal under AnimatePresence (forceMount).
 */
type DialogState = { open: boolean; setOpen: (open: boolean) => void }
const DialogStateContext = React.createContext<DialogState>({ open: false, setOpen: () => {} })

const Dialog = ({ open: openProp, defaultOpen, onOpenChange, ...props }: DialogPrimitive.DialogProps) => {
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
  const state = React.useMemo(() => ({ open, setOpen }), [open, setOpen])
  return (
    <DialogStateContext.Provider value={state}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </DialogStateContext.Provider>
  )
}

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

/** The blurred #0A0C16 85% backdrop behind every sheet. */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const { t } = useMotionPrefs()
  return (
    <DialogPrimitive.Overlay ref={ref} asChild forceMount {...props}>
      <motion.div
        className={cn("fixed inset-0 z-50", scrimClass, className)}
        initial={overlayMotion.initial}
        animate={overlayMotion.animate}
        exit={overlayMotion.exit}
        transition={t(overlayMotion.transition)}
      />
    </DialogPrimitive.Overlay>
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** How far (px) or how fast (px/s) a pull on the grabber has to be to close. */
const DISMISS_OFFSET = 120
const DISMISS_VELOCITY = 600

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(DialogStateContext)
  const { reduce, t } = useMotionPrefs()
  const dragControls = useDragControls()

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogOverlay />
          <DialogPrimitive.Content ref={ref} asChild forceMount {...props}>
            <motion.div
              className={cn(
                // Figma bottom sheet: full width on phones, pinned to the
                // bottom, rounded top corners only. Outer is non-scrolling so
                // the grabber and X stay put while the inner wrapper scrolls.
                "fixed inset-x-0 bottom-0 z-50 mx-auto flex flex-col w-full max-w-lg rounded-t-[28px] rounded-b-none bg-focus-sheet text-focus-text shadow-[0_-12px_40px_rgba(14,18,33,0.55)] overflow-hidden outline-none",
                "max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh]",
                className
              )}
              initial={sheetMotion.initial}
              animate={sheetMotion.animate}
              exit={{ ...sheetMotion.exit, transition: t(sheetMotion.exitTransition) }}
              transition={t(sheetMotion.transition)}
              drag={reduce ? false : "y"}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={onDragEnd}
            >
              {/* Grabber — pull down to dismiss. The hit area is taller than
                  the bar so it's easy to catch with a thumb. */}
              <div
                aria-hidden
                onPointerDown={(e) => dragControls.start(e)}
                className="flex h-7 shrink-0 cursor-grab touch-none items-end justify-center active:cursor-grabbing"
              >
                <span className="h-1 w-14 rounded-full bg-focus-lavender/70" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 grid gap-4">
                {children}
              </div>
              <DialogPrimitive.Close className={cn("absolute right-4 top-6 z-10", closeButtonClass)}>
                <X className={closeIconClass} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // Reserve room on the right so a long title never slides under the X.
      "text-20 font-semibold leading-tight tracking-tight text-focus-text pr-10",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-14 text-focus-muted", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
