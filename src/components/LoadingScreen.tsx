import SpritePet from "@/components/pets/SpritePet";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  /** Short line under the pet. Keep it child-legible on child screens. */
  label?: string;
  /** Fill the viewport (page-level) or just its container. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * The one loading state for the app: the rabbit idling and a short line.
 * Replaces a handful of unstyled "Loading..." strings that each looked
 * different.
 */
const LoadingScreen = ({ label = "One moment…", fullScreen = true, className }: LoadingScreenProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-sp-3 px-sp-4",
      fullScreen ? "min-h-dvh" : "py-sp-8",
      className,
    )}
    role="status"
    aria-live="polite"
  >
    <SpritePet mood="idle" size={96} label="Loading" />
    <p className="text-14 text-focus-muted">{label}</p>
  </div>
);

export default LoadingScreen;
