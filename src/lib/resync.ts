/**
 * "Refetch, you may have missed something." The child's screen stays open all
 * day, so it can't rely on the tab becoming visible again to refresh.
 * Realtime delivers changes as they happen, but anything made while the
 * connection was down is never replayed. Data hooks listen here and refetch
 * when:
 *   - the browser comes back online,
 *   - a realtime channel reconnects after a drop (see `resyncOnReconnect`),
 *   - every few minutes while the page is visible, as a backstop.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
const BACKSTOP_MS = 5 * 60_000;
// At most one resync a minute. When the database slows down, realtime channels drop and rejoin over
// and over; a full refetch on every rejoin, from every open page, is more load that drops them
// again (2026-10-22: the database stopped answering). The next one waits out the minute instead.
const MIN_GAP_MS = 60_000;
let pending: number | undefined;
let lastRun = 0;

/** Ask every listener to refetch. Bursts (several channels reconnecting at once) collapse into one,
 * and resyncs are at least a minute apart. */
export const requestResync = () => {
  if (pending !== undefined) return;
  const wait = Math.max(400, lastRun + MIN_GAP_MS - Date.now());
  pending = window.setTimeout(() => {
    pending = undefined;
    lastRun = Date.now();
    listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("resync listener failed", e);
      }
    });
  }, wait);
};

export const onResync = (cb: Listener) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/**
 * Pass as the callback to a realtime channel's `.subscribe()`. The first
 * SUBSCRIBED is the initial join; a SUBSCRIBED after an error or timeout means
 * the socket came back, so ask for a refetch.
 */
export const resyncOnReconnect = () => {
  let dropped = false;
  return (status: string) => {
    if (status === "SUBSCRIBED") {
      if (dropped) requestResync();
      dropped = false;
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      dropped = true;
    }
  };
};

if (typeof window !== "undefined") {
  window.addEventListener("online", requestResync);
  window.setInterval(() => {
    if (document.visibilityState === "visible") requestResync();
  }, BACKSTOP_MS);
}
