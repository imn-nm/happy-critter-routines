import { uicon, type UIconComponent } from "@/components/icons/UIcon";

export type TaskIconComponent = UIconComponent;

// Curated icon set the parent can pick from in the task form, drawn from
// Flaticon UIcons (regular, rounded). The `key` is what gets persisted on the
// task (tasks.icon); keep keys stable once shipped, even where the picture
// behind one has changed (e.g. "smile" is now a toothbrush). Add pictures with
// `python scripts/uicons.py <name>`.
export const ICON_OPTIONS: { key: string; label: string; Icon: TaskIconComponent }[] = [
  // Morning and night
  { key: "sunrise", label: "Wake up", Icon: uicon("sunrise") },
  { key: "bed", label: "Make bed", Icon: uicon("bed") },
  { key: "moon", label: "Bedtime", Icon: uicon("moon-stars") },
  { key: "clock", label: "Time", Icon: uicon("clock") },
  // Food and drink
  { key: "coffee", label: "Breakfast", Icon: uicon("egg-fried") },
  { key: "sandwich", label: "Lunch", Icon: uicon("sandwich") },
  { key: "utensils", label: "Dinner", Icon: uicon("plate-utensils") },
  { key: "cookie", label: "Snack", Icon: uicon("cookie") },
  { key: "apple", label: "Fruit", Icon: uicon("apple-whole") },
  { key: "carrot", label: "Veggies", Icon: uicon("carrot") },
  { key: "droplet", label: "Water", Icon: uicon("glass-water-droplet") },
  // Washing up and getting dressed
  { key: "smile", label: "Teeth", Icon: uicon("toothbrush") },
  { key: "soap", label: "Wash hands", Icon: uicon("soap") },
  { key: "toilet", label: "Toilet", Icon: uicon("toilet") },
  { key: "bath", label: "Bath", Icon: uicon("bath") },
  { key: "shower", label: "Shower", Icon: uicon("shower") },
  { key: "shirt", label: "Get dressed", Icon: uicon("shirt") },
  { key: "shoes", label: "Shoes", Icon: uicon("shoe-prints") },
  // School and learning
  { key: "school", label: "School", Icon: uicon("school") },
  { key: "backpack", label: "Pack bag", Icon: uicon("backpack") },
  { key: "bus", label: "Bus", Icon: uicon("school-bus") },
  { key: "car", label: "Car", Icon: uicon("car-side") },
  { key: "pencil", label: "Homework", Icon: uicon("pencil") },
  { key: "book", label: "Reading", Icon: uicon("book-open-reader") },
  { key: "music", label: "Music", Icon: uicon("music-alt") },
  { key: "palette", label: "Art", Icon: uicon("palette") },
  // Moving and playing
  { key: "dumbbell", label: "Exercise", Icon: uicon("running") },
  { key: "ball", label: "Sports", Icon: uicon("football") },
  { key: "swim", label: "Swimming", Icon: uicon("swimmer") },
  { key: "bike", label: "Bike", Icon: uicon("bike") },
  { key: "outside", label: "Outside", Icon: uicon("tree") },
  { key: "yoga", label: "Calm down", Icon: uicon("meditation") },
  { key: "toys", label: "Toys", Icon: uicon("cubes") },
  { key: "game", label: "Games", Icon: uicon("gamepad") },
  { key: "tablet", label: "Screen time", Icon: uicon("tablet") },
  { key: "tv", label: "TV", Icon: uicon("tv-retro") },
  { key: "friends", label: "Friends", Icon: uicon("users") },
  // Chores
  { key: "clean", label: "Tidy up", Icon: uicon("broom") },
  { key: "dishes", label: "Dishes", Icon: uicon("sink") },
  { key: "laundry", label: "Laundry", Icon: uicon("washer") },
  { key: "trash", label: "Trash", Icon: uicon("trash") },
  { key: "plant", label: "Plants", Icon: uicon("seedling") },
  { key: "pet", label: "Dog", Icon: uicon("dog") },
  { key: "cat", label: "Cat", Icon: uicon("cat") },
  { key: "shopping", label: "Shopping", Icon: uicon("shopping-cart") },
  // Everything else
  { key: "medicine", label: "Medicine", Icon: uicon("medicine") },
  { key: "heart", label: "Heart", Icon: uicon("heart") },
  { key: "sparkles", label: "Fun", Icon: uicon("sparkles") },
  { key: "free", label: "Free time", Icon: uicon("kite") },
  { key: "star", label: "Star", Icon: uicon("star") },
];

const ICON_BY_KEY: Record<string, TaskIconComponent> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.key, o.Icon]),
);

// Picks an icon from the task's name when the parent hasn't chosen one.
// Order matters: earlier rules win, so the specific ones come first ("make
// bed" before "bed", "water plants" before "water"). Keywords match from the
// start of a word ("read" finds "reading" but not "bread"); end one with a
// space to match only the whole word ("car " skips "carrot" and "care").
const RULES: { keywords: string[]; key: string }[] = [
  { keywords: ["wake", "morning", "get up", "rise"], key: "sunrise" },
  { keywords: ["make bed", "make the bed", "make your bed"], key: "bed" },
  { keywords: ["bed ", "beds ", "bedtime", "sleep", "nap", "goodnight", "good night", "night"], key: "moon" },
  { keywords: ["teeth", "tooth", "floss", "dentist"], key: "smile" },
  { keywords: ["clean", "tidy", "chore", "vacuum", "sweep", "dust", "room", "bedroom"], key: "clean" },
  { keywords: ["medicine", "vitamin", "pill", "doctor"], key: "medicine" },
  { keywords: ["breakfast", "cereal", "pancake"], key: "coffee" },
  { keywords: ["lunch"], key: "sandwich" },
  { keywords: ["dinner", "supper", "set the table", "set table"], key: "utensils" },
  { keywords: ["snack"], key: "cookie" },
  { keywords: ["veg", "carrot", "salad"], key: "carrot" },
  { keywords: ["fruit", "eat", "meal", "food"], key: "apple" },
  { keywords: ["dish", "clear the table", "sink"], key: "dishes" },
  { keywords: ["shop", "store", "grocer", "errand"], key: "shopping" },
  { keywords: ["hands", "hand wash", "soap", "wash face", "wash your face"], key: "soap" },
  { keywords: ["toilet", "potty"], key: "toilet" },
  { keywords: ["shower"], key: "shower" },
  { keywords: ["bath", "wash"], key: "bath" },
  { keywords: ["laundry", "fold", "washing"], key: "laundry" },
  { keywords: ["dress", "clothes", "outfit", "pajama", "pyjama", "uniform", "shirt"], key: "shirt" },
  { keywords: ["shoe", "sock", "boot"], key: "shoes" },
  { keywords: ["pack", "backpack", "bag "], key: "backpack" },
  { keywords: ["bus"], key: "bus" },
  { keywords: ["car ", "drive", "driving"], key: "car" },
  { keywords: ["school", "preschool", "class", "kindergarten"], key: "school" },
  { keywords: ["homework", "study", "write", "writing", "journal", "spelling", "math"], key: "pencil" },
  { keywords: ["read", "book", "story", "stories", "library"], key: "book" },
  { keywords: ["exercise", "workout", "gym", "run", "stretch", "dance", "ballet", "karate", "hike"], key: "dumbbell" },
  { keywords: ["swim", "pool"], key: "swim" },
  { keywords: ["soccer", "football", "basketball", "ball", "sport", "tennis", "hockey", "baseball"], key: "ball" },
  { keywords: ["bike", "ride", "scooter", "skate", "cycl"], key: "bike" },
  { keywords: ["music", "piano", "guitar", "violin", "drum", "instrument", "sing", "practi"], key: "music" },
  { keywords: ["draw", "paint", "art", "craft", "color", "colour"], key: "palette" },
  { keywords: ["yoga", "calm", "breath", "meditat", "quiet", "relax", "wind down"], key: "yoga" },
  { keywords: ["tv", "movie", "cartoon", "film"], key: "tv" },
  { keywords: ["tablet", "ipad", "screen", "youtube", "phone", "computer"], key: "tablet" },
  { keywords: ["video game", "gaming", "game", "minecraft", "roblox", "nintendo"], key: "game" },
  { keywords: ["plant", "garden", "flower", "seed"], key: "plant" },
  { keywords: ["water", "drink"], key: "droplet" },
  { keywords: ["trash", "garbage", "rubbish", "bin ", "recycl"], key: "trash" },
  { keywords: ["toy", "lego", "block", "puzzle", "build"], key: "toys" },
  { keywords: ["outside", "outdoor", "park", "playground", "nature"], key: "outside" },
  { keywords: ["friend", "playdate", "play date", "party", "visit", "family"], key: "friends" },
  { keywords: ["free time", "free play"], key: "free" },
  { keywords: ["fun", "playtime", "play time", "reward"], key: "sparkles" },
  { keywords: ["play"], key: "game" },
  { keywords: ["cat ", "cats ", "kitten"], key: "cat" },
  { keywords: ["pet", "dog", "puppy", "feed", "walk", "fish", "hamster", "rabbit", "bunny"], key: "pet" },
];

/**
 * Resolve the icon component for a task. An explicit `iconKey` (chosen by
 * the parent) wins; otherwise fall back to keyword matching on the name.
 */
export function getTaskIconComponent(taskName: string, iconKey?: string | null): TaskIconComponent {
  return ICON_BY_KEY[getTaskIconKey(taskName, iconKey)];
}

/** The icon key a name picks (see getTaskIconComponent), for saving it. */
export function getTaskIconKey(taskName: string, iconKey?: string | null): string {
  if (iconKey && ICON_BY_KEY[iconKey]) return iconKey;
  const name = ` ${(taskName || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const { keywords, key } of RULES) {
    if (keywords.some((k) => name.includes(` ${k}`))) return key;
  }
  return "star";
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
