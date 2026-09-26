import { forwardRef, type ButtonHTMLAttributes, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Figma "edit-01" (Untitled UI) — a plain pencil. */
export const EditIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
    <path
      d="M2.39668 15.0964C2.43496 14.7518 2.45411 14.5795 2.50624 14.4185C2.55249 14.2756 2.61784 14.1396 2.70051 14.0143C2.79369 13.873 2.91627 13.7504 3.16142 13.5052L14.1667 2.5C15.0871 1.57952 16.5795 1.57952 17.5 2.5C18.4205 3.42047 18.4205 4.91286 17.5 5.83333L6.49475 16.8386C6.2496 17.0837 6.12702 17.2063 5.98572 17.2995C5.86035 17.3821 5.72439 17.4475 5.58152 17.4937C5.42048 17.5459 5.24819 17.565 4.90362 17.6033L2.08331 17.9167L2.39668 15.0964Z"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Figma "trash-02" (Untitled UI) — a bin with a lid. */
export const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
    <path
      d="M13.3333 5V4.33333C13.3333 3.39991 13.3333 2.9332 13.1517 2.57668C12.9919 2.26308 12.7369 2.00811 12.4233 1.84832C12.0668 1.66667 11.6001 1.66667 10.6667 1.66667H9.33333C8.39991 1.66667 7.9332 1.66667 7.57668 1.84832C7.26308 2.00811 7.00811 2.26308 6.84832 2.57668C6.66667 2.9332 6.66667 3.39991 6.66667 4.33333V5M2.5 5H17.5M15.8333 5V14.3333C15.8333 15.7335 15.8333 16.4335 15.5608 16.9683C15.3212 17.4387 14.9387 17.8212 14.4683 18.0608C13.9335 18.3333 13.2335 18.3333 11.8333 18.3333H8.16667C6.76654 18.3333 6.06647 18.3333 5.53169 18.0608C5.06129 17.8212 4.67883 17.4387 4.43915 16.9683C4.16667 16.4335 4.16667 15.7335 4.16667 14.3333V5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Figma "Reward actions" (369:392): 44×44, radius 12, surface fill, 20px
 * icon — iris pencil for edit, pink bin for delete. `label` is the
 * accessible name ("Edit Movie night").
 */
type IconActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { label: string };

const base =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-focus-surface transition-colors " +
  "hover:bg-focus-raised disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

export const EditButton = forwardRef<HTMLButtonElement, IconActionProps>(
  ({ label, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} aria-label={label} title={label} className={cn(base, "text-focus-iris", className)} {...props}>
      <EditIcon className="h-5 w-5" />
    </button>
  ),
);
EditButton.displayName = "EditButton";

export const DeleteButton = forwardRef<HTMLButtonElement, IconActionProps>(
  ({ label, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} aria-label={label} title={label} className={cn(base, "text-focus-pink", className)} {...props}>
      <TrashIcon className="h-5 w-5" />
    </button>
  ),
);
DeleteButton.displayName = "DeleteButton";
