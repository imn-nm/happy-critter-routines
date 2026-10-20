/**
 * /child/:childId: the child's day on the MyToki Circle, the round screen
 * of the handheld, running the device firmware in the browser on the real plan
 * (ChildCircleView), with a way to the list view and a real-size switch.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { List, Ruler } from "lucide-react";
import { circleRealSizePx } from "@/components/CircleDevice";
import ChildCircleView from "@/components/ChildCircleView";
import LoadingScreen from "@/components/LoadingScreen";
import { useChildren } from "@/hooks/useChildren";
import { useUnseenParentNotes } from "@/hooks/useParentNotes";
import ParentNoteOverlay from "@/components/ParentNoteOverlay";
import { lockParentMode } from "@/lib/parentLock";

const ChildCircle = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading: childrenLoading, loadError } = useChildren();
  const [fit, setFit] = useState(() => Math.min(600, window.innerWidth, window.innerHeight - 72));
  // Real size: the round screen drawn 1.75 inches across, as on the handheld (the Waveshare 1.75"
  // AMOLED, 466 px), measured in this screen's own inches (circleRealSizePx), at 100% zoom.
  const [realSize, setRealSize] = useState(() => { try { return localStorage.getItem("mytoki:real-size") === "1"; } catch { return false; } });
  const size = realSize ? circleRealSizePx() : fit;
  // A grown-up's note (why stars came, why a reward was a no), shown once
  // over the Circle. The handheld itself doesn't draw these yet.
  const { current: parentNote, dismiss: dismissParentNote } = useUnseenParentNotes(childId);

  useEffect(() => { lockParentMode(); }, []);
  useEffect(() => {
    const onResize = () => setFit(Math.min(600, window.innerWidth, window.innerHeight - 72));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const child = children.find(c => c.id === childId);

  if (childrenLoading && !child) return <LoadingScreen label="Getting your day ready…" fullScreen />;
  if (!child) {
    return (
      <div className="min-h-dvh bg-focus-bg text-focus-text flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-18">{loadError ? "We couldn’t load your family." : "We couldn’t find that child."}</p>
        <button type="button" className="rounded-full bg-focus-lime text-focus-bg px-5 py-2 text-16 font-semibold" onClick={() => navigate("/")}>Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-focus-bg text-focus-text flex flex-col items-center justify-center gap-4 py-4">
      <ChildCircleView childId={child.id} size={size} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/child/${child.id}/list`)}
          className="inline-flex items-center gap-2 rounded-full bg-focus-surface px-4 py-2 text-14 font-semibold text-focus-muted hover:text-focus-text"
        >
          <List className="w-4 h-4" aria-hidden /> List view
        </button>
        <button
          type="button"
          aria-pressed={realSize}
          title="Draw the screen 1.75 inches across, the size of the handheld's display"
          onClick={() => setRealSize(v => { const next = !v; try { localStorage.setItem("mytoki:real-size", next ? "1" : "0"); } catch { /* private mode */ } return next; })}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-14 font-semibold ${realSize ? "bg-focus-lime text-focus-bg" : "bg-focus-surface text-focus-muted hover:text-focus-text"}`}
        >
          <Ruler className="w-4 h-4" aria-hidden /> Real size 1.75″
        </button>
      </div>
      {/* Let the Circle's own "new stars" moment play before the note. */}
      <ParentNoteOverlay note={parentNote} child={child} onDone={dismissParentNote} delayMs={3500} />
    </div>
  );
};

export default ChildCircle;
