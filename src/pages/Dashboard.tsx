import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ChildCard, { type Child } from "@/components/ChildCard";
import TaskCard, { type Task } from "@/components/TaskCard";
import { Calendar, Plus, Settings, ListTodo } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChildren } from "@/hooks/useChildren";

// Mock data
const mockChildren: Child[] = [
  {
    id: "1",
    parent_id: "mock-parent-1",
    name: "Amira", 
    age: 8,
    petType: "owl",
    currentCoins: 45,
    petHappiness: 85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    parent_id: "mock-parent-1",
    name: "Noora",
    age: 6,
    petType: "fox", 
    currentCoins: 23,
    petHappiness: 72,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const mockTasks: Task[] = [
  {
    id: "1",
    name: "Wake up",
    type: "regular",
    scheduledTime: "7:00",
    coins: 5,
    isCompleted: true
  },
  {
    id: "2", 
    name: "School",
    type: "scheduled",
    scheduledTime: "8:00",
    duration: 480,
    coins: 10,
    isCompleted: false,
    isActive: true
  },
  {
    id: "3",
    name: "Shower",
    type: "regular", 
    scheduledTime: "16:30",
    duration: 20,
    coins: 5,
    isCompleted: false
  },
  {
    id: "4",
    name: "Homework",
    type: "flexible",
    scheduledTime: "17:00",
    duration: 60,
    coins: 8,
    isCompleted: false
  }
];

const mockEvents = [
  { id: "1", name: "Soccer Practice", time: "4:00 PM", child: "Amira" },
  { id: "2", name: "Parent-teacher conference", time: "3:30 PM", child: "Amira" }
];

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
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Today's Events</h2>
              </div>
              <div className="space-y-3">
                {mockEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{event.child}</p>
                    </div>
                    <span className="text-sm text-primary font-medium">{event.time}</span>
                  </div>
                ))}
              </div>
            </Card>
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
                      onClick={setSelectedChild}
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/tasks?childId=${child.id}`)}
                        className="flex-1 text-xs sm:text-sm"
                      >
                        <ListTodo className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        <span className="hidden sm:inline">Manage Tasks</span>
                        <span className="sm:hidden">Tasks</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/child/${child.id}`)}
                        className="flex-1 text-xs sm:text-sm"
                      >
                        <span className="hidden sm:inline">View Child Interface</span>
                        <span className="sm:hidden">View Interface</span>
                      </Button>
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