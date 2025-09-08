import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ChildCard, { type Child } from "@/components/ChildCard";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import UpcomingEventsForAll from "@/components/UpcomingEventsForAll";
import { Plus, Settings } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-primary p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Family Dashboard</h1>
          <div className="flex gap-2">
            <Button 
              variant="accent" 
              size="sm"
              onClick={() => navigate("/setup")}
            >
              <Plus className="w-4 h-4" />
              Add Child
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <UpcomingEventsForAll />
          </div>

          {/* Right Column - Children Cards */}
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-semibold mb-4">Your Children</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {children.map((child) => (
                  <div key={child.id} className="space-y-3">
                    <ChildCard
                      child={child}
                      isSelected={selectedChild?.id === child.id}
                      onClick={() => navigate(`/child-dashboard/${child.id}`)}
                    />
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <ChildProfileEdit child={child} />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/child/${child.id}`)}
                          className="flex-1 text-xs sm:text-sm"
                        >
                          <span className="hidden sm:inline">Child Interface</span>
                          <span className="sm:hidden">Interface</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;