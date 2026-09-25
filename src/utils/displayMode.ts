/**
 * Two ways the child's screen can look. Picture view is for children who
 * don't read clocks yet: big pictures, the day in simple blocks (morning,
 * afternoon, evening) and spoken prompts. Detailed view shows exact times
 * and says a little more about each task. Parents choose; until they do,
 * the child's age suggests one.
 */
export type DisplayMode = 'picture' | 'detailed';

/** Under 7 most children can't read a clock yet. */
export const suggestedDisplayMode = (age?: number | null): DisplayMode =>
  age != null && age < 7 ? 'picture' : 'detailed';

export const displayModeFor = (child: { age?: number | null; display_mode?: DisplayMode | null } | null | undefined): DisplayMode =>
  child?.display_mode ?? suggestedDisplayMode(child?.age);

export const DISPLAY_MODES: { value: DisplayMode; label: string; caption: string }[] = [
  { value: 'picture', label: 'Picture view', caption: 'Big pictures, the day in simple blocks, and spoken prompts. For children who don’t read clocks yet.' },
  { value: 'detailed', label: 'Detailed view', caption: 'Smaller icons, exact start and end times, and a line about what each task asks of them.' },
];
