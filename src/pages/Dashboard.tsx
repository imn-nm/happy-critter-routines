import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ChildCard, { type Child } from "@/components/ChildCard";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import UpcomingEventsForAll from "@/components/UpcomingEventsForAll";
import { Plus, Settings, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChildren } from "@/hooks/useChildren";

const Dashboard = () => {
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  // Set first child as selected when children load
  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0]);
    }
  }, [children, selectedChild]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8 text-white">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold text-white mb-4">Welcome to Taskie!</h1>
            <p className="text-white/80 mb-8">Let's start by setting up your first child's profile.</p>
            <Button 
              variant="accent" 
              size="lg"
              onClick={() => navigate("/setup")}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Your First Child
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-foreground hover:bg-white/50 rounded-xl h-10 px-3"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Child View</span>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Family Dashboard</h1>
          </div>
          <Button 
            size="sm"
            onClick={() => navigate("/setup")}
            className="rounded-2xl h-10 px-3 sm:px-4 shadow-sm text-sm font-medium"
            style={{ background: 'hsl(var(--accent-purple))' }}
          >
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Add Child</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div>
            {/* Upcoming Events */}
            <UpcomingEventsForAll />
          </div>

          {/* Right Column - Children Cards */}
          <div>
            <h2 className="text-foreground font-semibold mb-3 text-base sm:text-lg">Your Children</h2>
            <div className="grid grid-cols-1 gap-4">
              {children.map((child) => (
                <div key={child.id} className="space-y-2">
                  <ChildCard
                    child={child}
                    isSelected={false}
                    onClick={() => navigate(`/child-dashboard/${child.id}`)}
                  />
                  <ChildProfileEdit child={child} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;