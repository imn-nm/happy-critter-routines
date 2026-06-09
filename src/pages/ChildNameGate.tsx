import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChildren } from "@/hooks/useChildren";
import { useAuth } from "@/hooks/useAuth";

const ChildNameGate = () => {
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const { signOut, user } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;

    const match = children.find(
      (c) => c.name.toLowerCase() === trimmed
    );
    if (match) {
      navigate(`/child/${match.id}`);
    } else {
      setError("Name not found. Try again.");
      setName("");
    }
  };

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
          <p className="text-sm text-muted-foreground">Type your name to get started</p>
        </div>

        <div className="glass-card rounded-3xl p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-center text-lg"
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button type="submit" className="w-full">
              Let's go!
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChildNameGate;
