import type { FC, SVGProps } from "react";
import { UICON_PATHS, UICON_VIEWBOX, type UiconName } from "./uiconPaths";

export type UIconProps = SVGProps<SVGSVGElement>;
export type UIconComponent = FC<UIconProps>;

/**
 * A Flaticon UIcon (regular, rounded) as a component that behaves like a
 * lucide icon: 24px unless `className` sizes it (w-6 h-6), and it takes its
 * colour from `text-*` via currentColor. Uicons by Flaticon.
 */
export function uicon(name: UiconName): UIconComponent {
  const Icon: UIconComponent = (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={UICON_VIEWBOX}
      width={24}
      height={24}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={UICON_PATHS[name]} />
    </svg>
  );
  Icon.displayName = `UIcon(${name})`;
  return Icon;
}
