/**
 * Two ways the child's screen can look. Picture view is for children still
 * learning to read: big pictures with the clock time beside them, the day in
 * simple blocks (morning, afternoon, evening) and spoken prompts. Detailed
 * view adds end times and lengths and says a little more about each task.
 * Parents choose; until they do, the child's age suggests one.
 */
export type DisplayMode = 'picture' | 'detailed';

/** Under 7 most children can't read a clock yet. */
export const suggestedDisplayMode = (age?: number | null): DisplayMode =>
  age != null && age < 7 ? 'picture' : 'detailed';

export const displayModeFor = (child: { age?: number | null; display_mode?: DisplayMode | null } | null | undefined): DisplayMode =>
  child?.display_mode ?? suggestedDisplayMode(child?.age);

export const DISPLAY_MODES: { value: DisplayMode; label: string; caption: string }[] = [
  { value: 'picture', label: 'Picture view', caption: 'Big pictures with the time beside them, the day in simple blocks, and spoken prompts. For children still learning to read.' },
  { value: 'detailed', label: 'Detailed view', caption: 'Smaller icons, exact start and end times, and a line about what each task asks of them.' },
];
