import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChildren } from "@/hooks/useChildren";
import { useAuth } from "@/hooks/useAuth";
import CritterPet from "@/components/critters/CritterPet";
import LoadErrorCard from "@/components/LoadErrorCard";

const ChildNameGate = () => {
  const navigate = useNavigate();
  const { children, loading, loadError, refetch } = useChildren();
  const { signOut, user } = useAuth();

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

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-[20px] bg-focus-surface flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-focus-lavender" />
          </div>
          <h1 className="text-24 font-bold text-focus-text">Who's Using This?</h1>
          <p className="text-14 text-focus-muted">Tap your name to get started</p>
        </div>

        {/* One tile per child — pet + name, big tap targets so even
            pre-readers can pick themselves out by their critter. */}
        <div className="grid grid-cols-2 gap-3">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => navigate(`/child/${child.id}`)}
              className="bg-focus-surface rounded-[24px] p-4 flex flex-col items-center gap-2 transition-colors hover:bg-focus-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              <CritterPet petType={child.petType} outfit={child.pet_outfit} mood="happy" size={96} />
              <span className="text-18 font-semibold text-focus-text truncate w-full text-center">
                {child.name}
              </span>
            </button>
          ))}
        </div>

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
