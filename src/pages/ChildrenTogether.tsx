import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import LoadErrorCard from "@/components/LoadErrorCard";
import ChildCircleView from "@/components/ChildCircleView";
import { useChildren, type Child } from "@/hooks/useChildren";
import { MAX_TOGETHER, MIN_PANE_WIDTH, useSideBySideSlots } from "@/hooks/useSideBySide";
import { lockParentMode } from "@/lib/parentLock";
import { cn } from "@/lib/utils";

/** One child's column: their name, then their MyToki Circle as big as the column allows. */
const Column = ({ child }: { child: Child }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setSize(Math.floor(Math.min(600, el.clientWidth - 24, el.clientHeight - 24)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="h-full flex flex-col items-center gap-2 py-4">
      <p className="text-18 font-semibold text-focus-text">{child.name}</p>
      <div ref={ref} className="flex-1 min-h-0 w-full flex items-center justify-center">
        {size > 0 && <ChildCircleView childId={child.id} size={size} keyboard={false} />}
      </div>
    </div>
  );
};

/**
 * Up to three children's MyToki Circles side by side, for a shared iPad or computer
 * (/child/together, or ?kids=id,id to pick who). Each Circle runs its own copy of the
 * device on that child's day, so each child taps their own; the keyboard button is off
 * here (it would press them all). If the screen gets too narrow for everyone (an iPad
 * turned upright), the row scrolls sideways a child at a time.
 */
const ChildrenTogether = () => {
  const { children, loading, loadError, refetch } = useChildren();
  const [params] = useSearchParams();
  const slots = useSideBySideSlots();

  useEffect(() => { lockParentMode(); }, []);

  if (loading) return <LoadingScreen label="Getting ready…" />;
  if (children.length === 0 && loadError) return <LoadErrorCard onRetry={refetch} />;

  const picked = [...new Set(params.get("kids")?.split(",").filter(Boolean) ?? [])];
  const kids = (picked.length
    ? picked.map(id => children.find(c => c.id === id)).filter((c): c is Child => !!c)
    : children
  ).slice(0, MAX_TOGETHER);

  if (kids.length === 0) return <Navigate to="/" replace />;
  if (kids.length === 1) return <Navigate to={`/child/${kids[0].id}`} replace />;

  // Columns share the screen evenly; the ones that don't fit are a swipe away.
  const columnWidth = `${100 / Math.min(slots, kids.length)}%`;

  return (
    <div className="h-dvh flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory bg-focus-bg">
      {kids.map((child, i) => (
        <section
          key={child.id}
          aria-label={`${child.name}'s screen`}
          className={cn("relative h-full shrink-0 snap-start overflow-clip bg-focus-bg", i > 0 && "border-l border-focus-raised")}
          style={{ width: columnWidth, minWidth: MIN_PANE_WIDTH }}
        >
          <Column child={child} />
        </section>
      ))}
    </div>
  );
};

export default ChildrenTogether;
