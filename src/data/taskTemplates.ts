/**
 * Built-in suggestions for common tasks: a sensible length, an icon, and a
 * checklist a child can follow. Matched from the task's name as the parent
 * types it. Everything suggested stays editable; nothing is applied to a task
 * that already has its own settings.
 *
 * Steps come in two versions: short and concrete for younger children
 * (under 7), a little more independent for older ones.
 */
export interface TaskTemplate {
  /** Lowercase words or phrases that identify the task in its name. */
  keys: string[];
  /** Key from ICON_OPTIONS (src/utils/taskIcon.tsx). */
  icon: string;
  /** Suggested length in minutes (always one of the form's options). */
  duration: number;
  steps: { young: string[]; older: string[] };
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    keys: ['brush teeth', 'teeth', 'brush your teeth'],
    icon: 'smile',
    duration: 5,
    steps: {
      young: ['Toothpaste on the brush', 'Brush the top teeth', 'Brush the bottom teeth', 'Spit and rinse'],
      older: ['Brush for two minutes', 'Floss', 'Rinse and put the brush away'],
    },
  },
  {
    keys: ['get dressed', 'dressed', 'clothes on'],
    icon: 'shirt',
    duration: 10,
    steps: {
      young: ['Pajamas off', 'Put on underwear and socks', 'Put on shirt and pants', 'Pajamas in the basket'],
      older: ['Pick an outfit', 'Get dressed', 'Put pajamas away'],
    },
  },
  {
    keys: ['breakfast'],
    icon: 'coffee',
    duration: 20,
    steps: {
      young: ['Wash hands', 'Eat breakfast', 'Plate to the sink'],
      older: ['Eat breakfast', 'Clear your place', 'Wipe the table if needed'],
    },
  },
  {
    keys: ['make bed', 'make your bed'],
    icon: 'sparkles',
    duration: 5,
    steps: {
      young: ['Pull up the blanket', 'Put the pillow on top', 'Stuffies on the bed'],
      older: ['Straighten the sheets', 'Pull up the blanket', 'Fluff the pillow'],
    },
  },
  {
    keys: ['pack bag', 'backpack', 'pack school bag', 'get ready for school', 'ready for school'],
    icon: 'school',
    duration: 10,
    steps: {
      young: ['Lunchbox in the bag', 'Water bottle in the bag', 'Shoes on', 'Jacket on'],
      older: ['Homework and books in the bag', 'Lunch and water bottle', 'Check what today needs (gym, library)', 'Shoes and jacket on'],
    },
  },
  {
    keys: ['homework', 'study', 'studying'],
    icon: 'pencil',
    duration: 30,
    steps: {
      young: ['Get your folder out', 'Do one page', 'Show a grown-up', 'Folder back in the bag'],
      older: ['Check what is due', 'Do the hardest part first', 'Check your work', 'Pack it for tomorrow'],
    },
  },
  {
    keys: ['reading', 'read', 'book', 'story time'],
    icon: 'book',
    duration: 20,
    steps: {
      young: ['Pick a book', 'Read together', 'Tell what happened'],
      older: ['Pick up where you left off', 'Read for 20 minutes', 'Note the page you reached'],
    },
  },
  {
    keys: ['bath', 'bath time'],
    icon: 'bath',
    duration: 20,
    steps: {
      young: ['Clothes in the basket', 'Wash body', 'Wash hair', 'Dry off with a towel', 'Pajamas on'],
      older: ['Wash up', 'Wash hair', 'Dry off and hang the towel', 'Pajamas on'],
    },
  },
  {
    keys: ['shower'],
    icon: 'bath',
    duration: 15,
    steps: {
      young: ['Clothes in the basket', 'Wash body', 'Wash hair', 'Dry off', 'Pajamas on'],
      older: ['Shower', 'Hang up your towel', 'Dirty clothes in the basket'],
    },
  },
  {
    keys: ['bedtime routine', 'get ready for bed', 'ready for bed', 'wind down'],
    icon: 'moon',
    duration: 30,
    steps: {
      young: ['Pajamas on', 'Brush teeth', 'Use the toilet', 'Pick a story', 'Lights out'],
      older: ['Pajamas on', 'Brush teeth', 'Pack for tomorrow', 'Read in bed', 'Lights out'],
    },
  },
  {
    keys: ['tidy', 'clean room', 'clean up', 'tidy room', 'pick up toys', 'clean your room'],
    icon: 'clean',
    duration: 15,
    steps: {
      young: ['Toys in the box', 'Books on the shelf', 'Clothes in the basket'],
      older: ['Clear the floor', 'Put clothes away', 'Clear your desk', 'Take out any cups or plates'],
    },
  },
  {
    keys: ['feed the dog', 'feed dog', 'feed the cat', 'feed cat', 'feed pet', 'feed the fish', 'feed fish'],
    icon: 'pet',
    duration: 5,
    steps: {
      young: ['Scoop the food', 'Fill the water bowl', 'Wash your hands'],
      older: ['Measure the food', 'Fresh water', 'Wash your hands'],
    },
  },
  {
    keys: ['walk the dog', 'walk dog', 'dog walk'],
    icon: 'pet',
    duration: 20,
    steps: {
      young: ['Leash on', 'Walk with a grown-up', 'Water for the dog after'],
      older: ['Leash and bags', 'Walk the loop', 'Fresh water when you get back'],
    },
  },
  {
    keys: ['set the table', 'set table'],
    icon: 'utensils',
    duration: 5,
    steps: {
      young: ['Plates', 'Forks and spoons', 'Cups'],
      older: ['Plates and napkins', 'Cutlery', 'Glasses and water'],
    },
  },
  {
    keys: ['dishes', 'unload dishwasher', 'load dishwasher', 'clear the table'],
    icon: 'clean',
    duration: 10,
    steps: {
      young: ['Carry your plate to the sink', 'Scrape leftovers', 'Wipe your spot'],
      older: ['Clear the table', 'Load the dishwasher', 'Wipe the table'],
    },
  },
  {
    keys: ['lunch'],
    icon: 'sandwich',
    duration: 30,
    steps: {
      young: ['Wash hands', 'Eat lunch', 'Plate to the sink'],
      older: ['Wash hands', 'Eat lunch', 'Clear your place'],
    },
  },
  {
    keys: ['dinner', 'supper'],
    icon: 'utensils',
    duration: 45,
    steps: {
      young: ['Wash hands', 'Eat dinner', 'Plate to the sink'],
      older: ['Wash hands', 'Eat dinner', 'Clear your place', 'Help tidy the kitchen'],
    },
  },
  {
    keys: ['snack'],
    icon: 'cookie',
    duration: 15,
    steps: {
      young: ['Wash hands', 'Eat your snack', 'Wrapper in the bin'],
      older: ['Pick a snack', 'Eat at the table', 'Tidy up'],
    },
  },
  {
    keys: ['piano', 'violin', 'guitar', 'music practice', 'instrument'],
    icon: 'music',
    duration: 20,
    steps: {
      young: ['Warm-up', 'Play the new piece', 'Play a favourite'],
      older: ['Scales or warm-up', 'Work on the tricky part', 'Play the whole piece', 'Note what to practise next'],
    },
  },
  {
    keys: ['soccer', 'football', 'swim', 'swimming', 'gymnastics', 'basketball', 'karate', 'sports', 'soccer practice'],
    icon: 'dumbbell',
    duration: 60,
    steps: {
      young: ['Sports clothes on', 'Water bottle', 'Shoes on'],
      older: ['Pack your kit', 'Water bottle and snack', 'Be at the door on time'],
    },
  },
  {
    keys: ['tv', 'screen time', 'gaming', 'video games', 'tablet time', 'roblox'],
    icon: 'game',
    duration: 30,
    steps: { young: [], older: [] },
  },
  {
    keys: ['laundry', 'put clothes away', 'fold clothes'],
    icon: 'shirt',
    duration: 10,
    steps: {
      young: ['Socks together', 'Shirts in the drawer', 'Pants in the drawer'],
      older: ['Fold your clothes', 'Put them away', 'Basket back'],
    },
  },
  {
    keys: ['water plants', 'plants'],
    icon: 'plant',
    duration: 5,
    steps: {
      young: ['Fill the watering can', 'Water each plant', 'Put the can back'],
      older: ['Check which plants are dry', 'Water them', 'Put the can back'],
    },
  },
  {
    keys: ['wake up', 'morning routine'],
    icon: 'sunrise',
    duration: 15,
    steps: {
      young: ['Open the curtains', 'Use the toilet', 'Wash your face'],
      older: ['Get up with the alarm', 'Use the toilet', 'Wash your face', 'Make your bed'],
    },
  },
  {
    keys: ['play time', 'playtime', 'free play', 'play outside'],
    icon: 'sparkles',
    duration: 30,
    steps: { young: [], older: [] },
  },
  {
    keys: ['drawing', 'art', 'craft', 'colouring', 'coloring', 'painting'],
    icon: 'palette',
    duration: 30,
    steps: { young: [], older: [] },
  },
];

/** Under 7 gets the simpler steps. Unknown age counts as older. */
export const isYoungChild = (age?: number | null) => age != null && age > 0 && age < 7;

/**
 * The template for a task name: the longest matching phrase wins, so "walk
 * the dog" beats "dog" and "bedtime routine" beats "bed".
 */
export const templateForName = (name: string): TaskTemplate | null => {
  const n = ` ${name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  if (n.trim().length < 2) return null;
  let best: { t: TaskTemplate; len: number } | null = null;
  for (const t of TASK_TEMPLATES) {
    for (const k of t.keys) {
      if (n.includes(` ${k} `) && (!best || k.length > best.len)) best = { t, len: k.length };
    }
  }
  return best?.t ?? null;
};

/** 3–5 suggested checklist steps for a name and age; empty when none fit. */
export const suggestedSteps = (name: string, age?: number | null): string[] => {
  const t = templateForName(name);
  if (!t) return [];
  const steps = isYoungChild(age) ? t.steps.young : t.steps.older;
  return steps.slice(0, 5);
};
