/**
 * Kid mode for a shared device. Opening a child's screen locks the grown-up
 * side on this device; the parent PIN unlocks it. Kept in localStorage so a
 * reload, the browser's Back button or a typed URL can't skip the PIN.
 * Only enforced when the household has a PIN set.
 */
const KEY = "petpals:parent-locked";

export const lockParentMode = () => {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable: nothing to remember */
  }
};

export const unlockParentMode = () => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

export const isParentModeLocked = () => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
