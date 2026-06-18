// Human-friendly duration. Under an hour shows "45min"; once it exceeds 59
// minutes it switches to "1hr 30min" (or "2hr" when there are no extra minutes).
export function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}hr ${mins}min` : `${hours}hr`;
}
