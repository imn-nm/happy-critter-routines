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

export function toast({ title, description, variant, duration }: ToastArgs) {
  const message = title ?? description ?? "";
  const opts = { description: title ? description : undefined, duration };
  return variant === "destructive" ? sonner.error(message, opts) : sonner(message, opts);
}

export const useToast = () => ({ toast, dismiss: sonner.dismiss });
