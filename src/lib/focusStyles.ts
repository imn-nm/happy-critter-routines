/**
 * Shared Focus (parent hub) element styles, copied from the Figma
 * "Focus — Components" sheet so every screen draws them the same way.
 */

/** Figma 384:3321 — 44×44, radius 16, surface fill, sh/md shadow, 20px muted X. */
export const closeButtonClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-focus-surface text-focus-muted " +
  "shadow-[0_4px_12px_rgba(44,34,75,0.52)] transition-colors hover:bg-focus-raised hover:text-focus-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender disabled:pointer-events-none";

/** The X inside closeButtonClass. */
export const closeIconClass = "h-5 w-5";

/**
 * The backdrop behind every popup, drawer, menu and overlay: #0A0C16 at 85%
 * with a blur, covering the page (never the popup itself).
 */
export const scrimClass = "bg-focus-scrim/85 backdrop-blur-md";
