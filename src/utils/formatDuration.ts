// Human-friendly duration, in the Figma parent hub format: under an hour
// shows "45 min"; from an hour it's "1 h 30 min" (or "2 h" when there are
// no extra minutes).
export function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}
