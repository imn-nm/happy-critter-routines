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
  Heart,
  Star,
  Clock,
  type LucideIcon,
} from "lucide-react";

// Curated icon set the parent can pick from in the task form. The `key` is what
// gets persisted on the task (tasks.icon); keep keys stable once shipped.
export const ICON_OPTIONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "sunrise", label: "Wake up", Icon: Sunrise },
  { key: "moon", label: "Bedtime", Icon: Moon },
  { key: "coffee", label: "Breakfast", Icon: Coffee },
  { key: "sandwich", label: "Lunch", Icon: Sandwich },
  { key: "utensils", label: "Dinner", Icon: UtensilsCrossed },
  { key: "cookie", label: "Snack", Icon: Cookie },
  { key: "apple", label: "Fruit", Icon: Apple },
  { key: "droplet", label: "Water", Icon: Droplet },
  { key: "smile", label: "Teeth", Icon: Smile },
  { key: "bath", label: "Bath", Icon: Bath },
  { key: "school", label: "School", Icon: GraduationCap },
  { key: "book", label: "Reading", Icon: BookOpen },
  { key: "pencil", label: "Writing", Icon: Pencil },
  { key: "music", label: "Music", Icon: Music },
  { key: "palette", label: "Art", Icon: Palette },
  { key: "bike", label: "Bike", Icon: Bike },
  { key: "dumbbell", label: "Exercise", Icon: Dumbbell },
  { key: "game", label: "Play", Icon: Gamepad2 },
  { key: "clean", label: "Clean", Icon: Brush },
  { key: "shirt", label: "Laundry", Icon: Shirt },
  { key: "plant", label: "Plants", Icon: Flower2 },
  { key: "pet", label: "Pet", Icon: Dog },
  { key: "shopping", label: "Shopping", Icon: ShoppingCart },
  { key: "clock", label: "Time", Icon: Clock },
  { key: "heart", label: "Heart", Icon: Heart },
  { key: "sparkles", label: "Fun", Icon: Sparkles },
  { key: "star", label: "Star", Icon: Star },
];

const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.key, o.Icon]),
);

// Maps a task name to an appropriate lucide icon for the child view.
// Order matters — earlier, more specific keywords win. Falls back to a star.
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

/**
 * Resolve the lucide icon component for a task. An explicit `iconKey` (chosen by
 * the parent) wins; otherwise fall back to keyword matching on the name.
 */
export function getTaskIconComponent(taskName: string, iconKey?: string | null): LucideIcon {
  if (iconKey && ICON_BY_KEY[iconKey]) return ICON_BY_KEY[iconKey];
  const name = (taskName || "").toLowerCase();
  for (const { keywords, Icon } of RULES) {
    if (keywords.some((k) => name.includes(k))) return Icon;
  }
  return Star;
}

/** Render the icon for a task. `className` controls size/color. */
export function getTaskIcon(
  taskName: string,
  className = "w-4 h-4 text-foreground/60",
  iconKey?: string | null,
) {
  const Icon = getTaskIconComponent(taskName, iconKey);
  return <Icon className={className} />;
}
