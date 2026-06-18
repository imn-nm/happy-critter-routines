import {
  Sunrise,
  Moon,
  Coffee,
  Sandwich,
  UtensilsCrossed,
  Apple,
  Cookie,
  GraduationCap,
  BookOpen,
  Pencil,
  Music,
  Dumbbell,
  Bike,
  Gamepad2,
  Brush,
  Sparkles,
  Bath,
  ShoppingCart,
  Dog,
  Flower2,
  Shirt,
  Droplet,
  Palette,
  Smile,
  Star,
  type LucideIcon,
} from "lucide-react";

// Maps a task name to an appropriate lucide icon for the child view.
// Order matters — earlier, more specific keywords win (e.g. "brush teeth"
// matches teeth before a generic match). Falls back to a star.
const RULES: { keywords: string[]; Icon: LucideIcon }[] = [
  { keywords: ["wake", "morning", "get up"], Icon: Sunrise },
  { keywords: ["bed", "sleep", "bedtime", "nap", "goodnight"], Icon: Moon },
  { keywords: ["breakfast"], Icon: Coffee },
  { keywords: ["lunch"], Icon: Sandwich },
  { keywords: ["dinner", "supper"], Icon: UtensilsCrossed },
  { keywords: ["snack"], Icon: Cookie },
  { keywords: ["fruit", "eat", "meal"], Icon: Apple },
  { keywords: ["water", "drink"], Icon: Droplet },
  { keywords: ["teeth", "brush teeth", "dentist", "floss"], Icon: Smile },
  { keywords: ["bath", "shower", "wash"], Icon: Bath },
  { keywords: ["school", "class"], Icon: GraduationCap },
  { keywords: ["homework", "study", "read", "reading"], Icon: BookOpen },
  { keywords: ["write", "journal", "spelling"], Icon: Pencil },
  { keywords: ["music", "piano", "guitar", "practice", "violin"], Icon: Music },
  { keywords: ["draw", "paint", "art", "craft", "color"], Icon: Palette },
  { keywords: ["bike", "ride", "scooter"], Icon: Bike },
  { keywords: ["exercise", "workout", "gym", "run", "sport", "soccer", "stretch"], Icon: Dumbbell },
  { keywords: ["play", "game", "toys", "lego"], Icon: Gamepad2 },
  { keywords: ["clean", "tidy", "room", "chore", "vacuum", "dishes"], Icon: Brush },
  { keywords: ["laundry", "clothes", "dress", "fold"], Icon: Shirt },
  { keywords: ["plant", "garden", "flower", "water plant"], Icon: Flower2 },
  { keywords: ["pet", "dog", "cat", "feed", "walk"], Icon: Dog },
  { keywords: ["shop", "store", "grocery", "errand"], Icon: ShoppingCart },
  { keywords: ["fun", "free time", "reward"], Icon: Sparkles },
];

/** Resolve the lucide icon component for a task name. */
export function getTaskIconComponent(taskName: string): LucideIcon {
  const name = (taskName || "").toLowerCase();
  for (const { keywords, Icon } of RULES) {
    if (keywords.some((k) => name.includes(k))) return Icon;
  }
  return Star;
}

/** Render the icon for a task name. `className` controls size/color. */
export function getTaskIcon(taskName: string, className = "w-4 h-4 text-foreground/60") {
  const Icon = getTaskIconComponent(taskName);
  return <Icon className={className} />;
}
