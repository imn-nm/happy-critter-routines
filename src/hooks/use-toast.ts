import type { ReactNode } from "react";
import { toast as sonner } from "sonner";

/**
 * Compatibility shim over sonner for the older shadcn-style call sites
 * (`toast({ title, description, variant })`). The app has a single toast
 * system now; new code should import `toast` from "sonner" directly.
 */
export interface ToastArgs {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
}

// The child's screen shows no grown-up error toasts ("Failed to update
// child"): it has its own gentle states instead (saves retried quietly, a
// "try again" line on a reward ask), and a red error means nothing to a kid.
const onChildScreen = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/child/");

export function toast({ title, description, variant, duration }: ToastArgs) {
  if (variant === "destructive" && onChildScreen()) {
    console.warn("[toast hidden on child screen]", title, description);
    return undefined;
  }
  const message = title ?? description ?? "";
  const opts = { description: title ? description : undefined, duration };
  return variant === "destructive" ? sonner.error(message, opts) : sonner(message, opts);
}

export const useToast = () => ({ toast, dismiss: sonner.dismiss });
