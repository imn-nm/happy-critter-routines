/**
 * The add-task sentence says what the child does as an action ("Amira needs to
 * do homework"), while the day list shows a short label ("Homework"). A task
 * keeps saving its label as its name; these turn one into the other.
 */

/** Label → action, for the common tasks. `wants`: something they want to do (Wants to). */
export const TASK_PHRASES: { label: string; phrase: string; wants?: boolean }[] = [
  { label: 'Homework', phrase: 'do homework' },
  { label: 'Snack', phrase: 'have a snack' },
  { label: 'Reading', phrase: 'read' },
  { label: 'TV', phrase: 'watch TV', wants: true },
  { label: 'Bike ride', phrase: 'ride a bike', wants: true },
  { label: 'Play outside', phrase: 'play outside', wants: true },
  { label: 'Piano', phrase: 'practice piano' },
  { label: 'Soccer practice', phrase: 'go to soccer practice' },
  { label: 'Bath', phrase: 'have a bath' },
  { label: 'Shower', phrase: 'have a shower' },
  { label: 'Brush teeth', phrase: 'brush teeth' },
  { label: 'Get dressed', phrase: 'get dressed' },
  { label: 'Make bed', phrase: 'make the bed' },
  { label: 'Pack bag', phrase: 'pack their bag' },
  { label: 'Tidy room', phrase: 'tidy their room' },
  { label: 'Laundry', phrase: 'put the laundry away' },
  { label: 'Feed the dog', phrase: 'feed the dog' },
  { label: 'Set the table', phrase: 'set the table' },
  { label: 'Drawing', phrase: 'draw', wants: true },
  { label: 'Games', phrase: 'play games', wants: true },
  { label: 'Bedtime routine', phrase: 'do the bedtime routine' },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Verbs a typed action may start with; dropped for the label ("do homework" → "Homework"). */
const LEADS = ['go to ', 'have a ', 'have an ', 'have ', 'do the ', 'do ', 'watch ', 'practice ', 'practise '];

/** What the parent typed in the sentence → the name the task is saved under. */
export function labelFor(typed: string): string {
  const t = norm(typed);
  if (!t) return '';
  const known = TASK_PHRASES.find(p => norm(p.phrase) === t || norm(p.label) === t);
  if (known) return known.label;
  const lead = LEADS.find(l => t.startsWith(l) && t.length > l.length);
  const rest = lead ? typed.trim().slice(lead.length).trim() : typed.trim();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** A task's name → how the sentence says it ("Homework" → "do homework"). Unknown names stay as they are. */
export function phraseFor(name: string): string {
  const n = norm(name);
  if (!n) return '';
  const known = TASK_PHRASES.find(p => norm(p.label) === n || norm(p.phrase) === n);
  if (known) return known.phrase;
  return name.trim().charAt(0).toLowerCase() + name.trim().slice(1);
}

/** Suggestions for what is typed so far (all of them when nothing is). */
export function phraseSuggestions(typed: string, limit = 6): typeof TASK_PHRASES {
  const t = norm(typed);
  if (!t) return TASK_PHRASES.slice(0, limit);
  return TASK_PHRASES
    .filter(p => norm(p.phrase).includes(t) || norm(p.label).includes(t))
    .slice(0, limit);
}

/** Is this something they want to do (TV, a bike ride), rather than need to? */
export const isWantsTask = (name: string) => {
  const n = norm(name);
  return TASK_PHRASES.some(p => p.wants && (norm(p.label) === n || norm(p.phrase) === n));
};

/** The sentence's wording for a known task ("TV" → "watch TV"); undefined for the rest. */
export const knownPhrase = (name: string) => {
  const n = norm(name);
  return TASK_PHRASES.find(p => norm(p.label) === n)?.phrase;
};
