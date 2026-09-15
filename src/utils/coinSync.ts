/**
 * Every useChildren() call keeps its own copy of the children list, so a
 * balance change made in one component (an alerts sheet approving a reward)
 * wouldn't reach the page showing the balance until the realtime feed caught
 * up — if it ever did. Anything that changes a balance announces the new
 * value here; every useChildren() instance applies it straight away.
 *
 * Same tab: a window event. Other tabs on this device (parent and child views
 * open side by side): a BroadcastChannel. Other devices still rely on the
 * children realtime feed and the child view's own refresh on approval.
 */
export interface CoinChange {
  childId: string;
  balance: number;
}

const EVENT = "child-coins-changed";
let channel: BroadcastChannel | null | undefined;

const getChannel = () => {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("child-coins");
  } catch {
    channel = null;
  }
  return channel;
};

export const broadcastCoins = (change: CoinChange) => {
  if (typeof window === "undefined" || typeof change.balance !== "number") return;
  window.dispatchEvent(new CustomEvent<CoinChange>(EVENT, { detail: change }));
  getChannel()?.postMessage(change);
};

export const onCoinsChanged = (fn: (change: CoinChange) => void) => {
  const local = (e: Event) => fn((e as CustomEvent<CoinChange>).detail);
  const remote = (e: MessageEvent<CoinChange>) => fn(e.data);
  window.addEventListener(EVENT, local);
  const ch = getChannel();
  ch?.addEventListener("message", remote);
  return () => {
    window.removeEventListener(EVENT, local);
    ch?.removeEventListener("message", remote);
  };
};
