import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The design system's type scale (tailwind.config fontSize: text-11 … text-24).
// Unknown to tailwind-merge, "text-14" read as a colour, so next to a real
// colour ("text-fog-50") it was silently dropped and the text lost its size.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["11", "12", "13", "14", "16", "18", "20", "24"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
