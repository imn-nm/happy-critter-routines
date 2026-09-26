import type { ReactNode } from "react";
import { Minus, Plus, Star, X } from "lucide-react";
import { motion } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import TimeSelect from "@/components/TimeSelect";
import { cn } from "@/lib/utils";
import { useMotionPrefs } from "@/lib/motion";
import { closeButtonClass, closeIconClass } from "@/lib/focusStyles";
import { choiceClass, fmtTime, tileClass } from "@/components/sheet/sheetStyles";

/**
 * Shared pieces of the Focus bottom sheets (task / chore sheet, the child's
 * profile, …) so every sheet reads and behaves the same: headings, captions,
 * lavender choices, radio option cards, time / select tiles, the star
 * stepper, switch rows, the header row and the pinned footer.
 */

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sheet header and footer
// ---------------------------------------------------------------------------

/** Left-aligned sheet title with the 44px close button beside it. */
export const SheetHeader = ({ title, onClose }: { title: ReactNode; onClose: () => void }) => (
  <div className="w-full flex items-center justify-between gap-3">
    <h2 className="text-16 font-semibold leading-9 text-focus-text">{title}</h2>
    <button type="button" onClick={onClose} aria-label="Close" className={closeButtonClass}>
      <X className={closeIconClass} />
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Pieces — defined at module level so they don't remount on every keystroke.
// ---------------------------------------------------------------------------

export const SectionHeading = ({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) => (
  <div className="flex items-center gap-2 min-w-0">
    <h3 id={id} className="text-16 font-semibold leading-[22px] text-focus-text">{children}</h3>
    {aside && <span className="text-12 leading-[17px] text-focus-muted">{aside}</span>}
  </div>
);

export const Caption = ({ children, tone = "muted", role, id }: { children: ReactNode; tone?: "muted" | "error" | "warn"; role?: string; id?: string }) => (
  <p
    id={id}
    role={role}
    className={cn(
      "text-12 leading-[17px]",
      tone === "muted" && "text-focus-muted",
      tone === "error" && "text-focus-coral",
      tone === "warn" && "text-focus-amber",
    )}
  >
    {children}
  </p>
);

/** Lavender-when-chosen pill for the sheet's either/or choices. */
export const ChoiceButton = ({
  selected,
  onClick,
  children,
  disabled,
  className,
  role = "radio",
  ariaLabel,
  title,
}: {
  selected: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  role?: "radio" | "checkbox";
  ariaLabel?: string;
  title?: string;
}) => {
  const { reduce } = useMotionPrefs();
  return (
    <motion.button
      type="button"
      role={role}
      aria-checked={selected}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled || reduce ? undefined : { scale: 0.97 }}
      className={cn(choiceClass(selected, className), "motion-reduce:transition-none")}
    >
      {children}
    </motion.button>
  );
};

/** One answer to "When does it happen?": a radio card that opens to show its pickers. */
export const OptionCard = ({
  selected,
  label,
  onSelect,
  caption,
  children,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  caption?: ReactNode;
  children?: ReactNode;
}) => (
  <div
    className={cn(
      "w-full rounded-[14px] border-[1.5px] bg-focus-surface transition-colors",
      selected ? "border-focus-lavender" : "border-transparent hover:bg-focus-raised",
    )}
  >
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="w-full min-h-11 flex items-center gap-2.5 px-3.5 py-3 text-left rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px]",
          selected
            ? "border-focus-lavender bg-focus-lavender shadow-[inset_0_0_0_3px_rgb(var(--focus-surface-rgb))]"
            : "border-focus-muted/70",
        )}
      />
      <span
        className={cn(
          "flex-1 min-w-0 text-14 leading-[18px]",
          selected ? "font-semibold text-focus-text" : "font-normal text-focus-muted",
        )}
      >
        {label}
      </span>
    </button>
    {selected && (caption || children) && (
      <div className="px-3.5 pb-3 -mt-0.5 flex flex-col gap-2.5">
        {caption && <Caption>{caption}</Caption>}
        {children}
      </div>
    )}
  </div>
);

export const TileText = ({ label, value }: { label: string; value: ReactNode }) => (
  <>
    <span className="text-12 font-medium leading-4 text-focus-muted">{label}</span>
    <span className="block w-full truncate text-[15px] font-semibold leading-5 text-focus-text">{value}</span>
  </>
);

/** A "Starts 3:00 pm" tile that opens the hour / minute / am-pm picker. */
export const TimeTile = ({
  label,
  value,
  onChange,
  stepMinutes = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: number;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" className={tileClass} aria-label={`${label}: ${fmtTime(value) || "not set"}`}>
        <TileText label={label} value={fmtTime(value) || "Pick a time"} />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-3 bg-focus-sheet border-focus-raised">
      <p className="text-12 font-medium text-focus-muted mb-2">{label}</p>
      <TimeSelect value={value} onChange={onChange} stepMinutes={stepMinutes} />
    </PopoverContent>
  </Popover>
);

/** A tile-shaped select ("Lasts 30 min", "Starts After Lunch"). */
export const SelectTile = ({
  label,
  value,
  display,
  onChange,
  options,
}: {
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger
      aria-label={label}
      className={cn(
        tileClass,
        "h-auto w-auto border-0 text-left ring-offset-0 focus:ring-2 focus:ring-focus-lavender focus:ring-offset-0 [&>svg]:hidden [&>span]:line-clamp-none",
      )}
    >
      <TileText label={label} value={<SelectValue>{display}</SelectValue>} />
    </SelectTrigger>
    <SelectContent className="max-h-60">
      {options.map(o => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const stepperButton =
  "h-11 w-12 shrink-0 rounded-[14px] bg-focus-bg text-focus-muted flex items-center justify-center transition-colors hover:enabled:text-focus-text disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

/** −  ★ 3  + */
export const StarStepper = ({ value, onChange, max }: { value: number; onChange: (value: number) => void; max: number }) => (
  <div className="w-full rounded-[20px] border border-focus-iris p-1">
    <div className="flex h-12 items-center justify-between">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label="Remove star" className={stepperButton}>
        <Minus className="w-4 h-4" />
      </button>
      <div className="flex flex-1 min-w-0 items-center justify-center gap-2" aria-live="polite">
        <Star className="w-4 h-4 text-focus-lime fill-focus-lime" strokeWidth={0} aria-hidden />
        <span className="text-20 font-semibold leading-9 text-focus-lime tabular-nums">{value}</span>
        <span className="sr-only">{value === 1 ? "star" : "stars"}</span>
      </div>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Add star" className={stepperButton}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/** A labelled switch row. */
export const SwitchRow = ({
  id,
  label,
  caption,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  caption?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={id} className="text-14 font-semibold text-focus-text">{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
    {caption && <Caption>{caption}</Caption>}
  </div>
);

