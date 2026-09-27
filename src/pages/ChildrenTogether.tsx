import { Navigate, useSearchParams } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import LoadErrorCard from "@/components/LoadErrorCard";
import { useChildren, type Child } from "@/hooks/useChildren";
import { MAX_TOGETHER, MIN_PANE_WIDTH, useSideBySideSlots } from "@/hooks/useSideBySide";
import { cn } from "@/lib/utils";
import ChildInterface from "./ChildInterface";

/**
 * Up to three children's screens side by side, for a shared iPad or computer
 * (/child/together, or ?kids=id,id to pick who). Each column is a whole
 * child screen that scrolls on its own; `transform` makes the column the
 * frame for its `fixed` layers, so one child's day sheet, rewards shop or
 * Playtime stays in that child's column. If the screen gets too narrow for
 * everyone (an iPad turned upright), the row scrolls sideways a child at a
 * time.
 */
const ChildrenTogether = () => {
  const { children, loading, loadError, refetch } = useChildren();
  const [params] = useSearchParams();
  const slots = useSideBySideSlots();

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
          className={cn(
            // clip, not hidden: a hidden box can still be scrolled (focus,
            // scrollIntoView), which slid a child's whole screen out of place.
            "relative h-full shrink-0 snap-start overflow-clip bg-focus-bg",
            i > 0 && "border-l border-focus-raised",
          )}
          style={{ width: columnWidth, minWidth: MIN_PANE_WIDTH, transform: "translateZ(0)" }}
        >
          <div className="h-full overflow-y-auto overscroll-contain">
            <ChildInterface childId={child.id} />
          </div>
        </section>
      ))}
    </div>
  );
};

export default ChildrenTogether;
