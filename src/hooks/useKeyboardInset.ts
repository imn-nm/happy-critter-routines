import { useEffect, useState } from "react";

/**
 * How much of the bottom of the page the on-screen keyboard covers, and how
 * tall the visible part is. iPhone Safari keeps the page its full height when
 * the keyboard opens and lays the keyboard over it, so anything pinned to the
 * bottom (the sheets) ends up behind it. Sheets lift themselves by `inset`
 * and keep within `height`. Zero and null when no keyboard is open.
 */
export function useKeyboardInset(active = true) {
  const [state, setState] = useState<{ inset: number; height: number | null }>({ inset: 0, height: null });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => {
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Under 80 px is browser chrome moving, not a keyboard.
      const open = covered > 80;
      setState(s => {
        const next = { inset: open ? covered : 0, height: open ? Math.round(vv.height) : null };
        return s.inset === next.inset && s.height === next.height ? s : next;
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return state;
}
