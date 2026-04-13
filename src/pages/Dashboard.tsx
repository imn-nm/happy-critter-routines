import { Button } from "@/components/ui/button";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import UpcomingEventsForAll from "@/components/UpcomingEventsForAll";
import { Plus, ArrowLeft, Sparkles, BarChart3, Eye, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChildren } from "@/hooks/useChildren";
import PetAvatar from "@/components/PetAvatar";

const Dashboard = () => {
  const navigate = useNavigate();
  const { children, loading, updateChild } = useChildren();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto text-center pt-24">
          <div className="w-16 h-16 rounded-2xl glass-strong flex items-center justify-center mx-auto mb-5 glow-purple">
            <Sparkles className="w-7 h-7 text-primary-light" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2 text-glow">Welcome to Taskie!</h1>
          <p className="text-muted-foreground text-sm mb-6">Add your first child to get started.</p>
          <Button size="lg" onClick={() => navigate("/setup")} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Your First Child
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold text-foreground text-glow">Family Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Child View
            </Button>
            <Button size="sm" onClick={() => navigate("/setup")} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Child
            </Button>
          </div>
        </div>

        {/* Children */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Children</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {children.map((child) => (
              <div key={child.id} className="glass-card rounded-2xl p-4 space-y-3">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/child-dashboard/${child.id}`)}
                >
                  <div className="flex-shrink-0">
                    <PetAvatar petType={child.petType} happiness={child.petHappiness} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground">{child.name}</h3>
                    <p className="text-xs text-muted-foreground">Age: {child.age || 'Not set'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 glass rounded-full px-2.5 py-1">
                    <Coins className="w-3.5 h-3.5 text-warning" />
                    <span className="text-sm font-bold text-foreground">{child.currentCoins}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ChildProfileEdit child={child} onUpdateChild={updateChild} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/child-dashboard/${child.id}`)}
                    className="gap-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Reports
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        <UpcomingEventsForAll />
      </div>
    </div>
  );
};

export default Dashboard;
