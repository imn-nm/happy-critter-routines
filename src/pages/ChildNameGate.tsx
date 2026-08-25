import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChildren } from "@/hooks/useChildren";
import { useAuth } from "@/hooks/useAuth";
import CritterPet from "@/components/critters/CritterPet";

const ChildNameGate = () => {
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const { signOut, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // No children set up yet — redirect to parent to create profiles
  if (children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl glass-strong flex items-center justify-center mx-auto glow-purple">
            <Sparkles className="w-9 h-9 text-primary-light" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-glow">Welcome to PetPals!</h1>
          <p className="text-sm text-muted-foreground">
            No children profiles yet. Go to the parent portal to set up your first profile,
            or switch accounts if you're on a child's device.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate("/parent")}
            >
              Go to Parent Portal
            </Button>
            <button
              type="button"
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Sign out{user?.email ? ` (${user.email})` : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl glass-strong flex items-center justify-center mx-auto glow-purple">
            <Sparkles className="w-8 h-8 text-primary-light" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-glow">Who's using this?</h1>
          <p className="text-sm text-muted-foreground">Tap your name to get started</p>
        </div>

        {/* One tile per child — pet + name, big tap targets so even
            pre-readers can pick themselves out by their critter. */}
        <div className="grid grid-cols-2 gap-3">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => navigate(`/child/${child.id}`)}
              className="glass-card rounded-3xl p-4 flex flex-col items-center gap-2 transition-transform hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CritterPet petType={child.petType} mood="happy" size={96} />
              <span className="text-lg font-semibold text-foreground truncate w-full text-center">
                {child.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChildNameGate;
