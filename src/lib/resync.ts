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
let pending: number | undefined;

/** Ask every listener to refetch. Bursts (several channels reconnecting at once) collapse into one. */
export const requestResync = () => {
  if (pending !== undefined) return;
  pending = window.setTimeout(() => {
    pending = undefined;
    listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("resync listener failed", e);
      }
    });
  }, 400);
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
