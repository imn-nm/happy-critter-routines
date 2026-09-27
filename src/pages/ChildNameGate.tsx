import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import { Check, Sparkles } from "lucide-react";
import { useSideBySideSlots } from "@/hooks/useSideBySide";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useChildren } from "@/hooks/useChildren";
import { useAuth } from "@/hooks/useAuth";
import CritterPet from "@/components/critters/CritterPet";
import LoadErrorCard from "@/components/LoadErrorCard";

const ChildNameGate = () => {
  const navigate = useNavigate();
  const { children, loading, loadError, refetch } = useChildren();
  const { signOut, user } = useAuth();
  // On an iPad or computer, children share the screen side by side.
  const slots = useSideBySideSlots();
  const [picked, setPicked] = useState<string[]>([]);

  if (loading) {
    return <LoadingScreen label="Getting ready…" />;
  }

  if (children.length === 0 && loadError) {
    return <LoadErrorCard onRetry={refetch} />;
  }

  // No children set up yet — redirect to parent to create profiles
  if (children.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-[24px] bg-focus-surface flex items-center justify-center mx-auto">
            <Sparkles className="w-9 h-9 text-focus-lavender" />
          </div>
          <h1 className="text-24 font-bold text-focus-text">Welcome to PetPals!</h1>
          <p className="text-14 text-focus-muted">
            No children profiles yet. Go to the parent portal to set up your first profile,
            or switch accounts if you're on a child's device.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              onClick={() => navigate("/parent")}
            >
              Go to Parent Portal
            </Button>
            <button
              type="button"
              onClick={signOut}
              className="min-h-11 text-13 text-focus-muted hover:text-focus-text transition"
            >
              Sign Out{user?.email ? ` (${user.email})` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Everyone fits side by side: straight to their screens together.
  if (slots >= 2 && children.length >= 2 && children.length <= slots) {
    return <Navigate to="/child/together" replace />;
  }
  // More children than fit: pick who's here, up to what fits.
  const choosing = slots >= 2 && children.length > slots;
  const full = picked.length >= slots;
  const togglePicked = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(p => p !== id) : full ? prev : [...prev, id]));
  const start = () =>
    navigate(picked.length === 1 ? `/child/${picked[0]}` : `/child/together?kids=${picked.join(',')}`);

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-[20px] bg-focus-surface flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-focus-lavender" />
          </div>
          <h1 className="text-24 font-bold text-focus-text">{choosing ? "Who's Here?" : "Who's Using This?"}</h1>
          <p className="text-14 text-focus-muted">
            {choosing ? `Tap up to ${slots} names to share the screen` : 'Tap your name to get started'}
          </p>
        </div>

        {/* One tile per child — pet + name, big tap targets so even
            pre-readers can pick themselves out by their critter. */}
        <div className="grid grid-cols-2 gap-3">
          {children.map((child) => {
            const on = picked.includes(child.id);
            return (
              <button
                key={child.id}
                type="button"
                aria-pressed={choosing ? on : undefined}
                disabled={choosing && full && !on}
                onClick={() => (choosing ? togglePicked(child.id) : navigate(`/child/${child.id}`))}
                className={cn(
                  "relative bg-focus-surface rounded-[24px] p-4 flex flex-col items-center gap-2 transition-colors hover:bg-focus-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender disabled:opacity-40 disabled:active:scale-100",
                  on && "ring-2 ring-focus-lavender",
                )}
              >
                {on && (
                  <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-focus-lavender text-focus-bg flex items-center justify-center" aria-hidden>
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                )}
                <CritterPet petType={child.petType} outfit={child.pet_outfit} seed={child.id} mood="happy" size={96} />
                <span className="text-18 font-semibold text-focus-text truncate w-full text-center">
                  {child.name}
                </span>
              </button>
            );
          })}
        </div>

        {choosing && (
          <Button variant="primary" className="w-full" disabled={picked.length === 0} onClick={start}>
            Start
          </Button>
        )}

        {/* Low-emphasis way back for the parent; kids' tiles stay the focus. */}
        <div className="flex justify-center pt-sp-2">
          <button
            type="button"
            onClick={() => navigate("/parent")}
            className="min-h-11 px-4 rounded-[14px] text-13 font-semibold text-focus-muted hover:bg-focus-surface hover:text-focus-text transition-colors"
          >
            Grown-ups
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChildNameGate;
