import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ChildCard, { type Child } from "@/components/ChildCard";
import TaskCard, { type Task } from "@/components/TaskCard";
import { Calendar, Plus, Settings, ListTodo } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Mock data
const mockChildren: Child[] = [
  {
    id: "1",
    name: "Amira", 
    age: 8,
    petType: "owl",
    currentCoins: 45,
    petHappiness: 85,
    currentTask: {
      name: "School",
      timeLeft: "2hrs 20min"
    }
  },
  {
    id: "2",
    name: "Noora",
    age: 6,
    petType: "fox", 
    currentCoins: 23,
    petHappiness: 72,
    currentTask: {
      name: "Free Play",
      timeLeft: "30min"
    }
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
  const [selectedChild, setSelectedChild] = useState<Child>(mockChildren[0]);
  const navigate = useNavigate();

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
            <Button 
              variant="gradientSecondary" 
              size="sm"
              onClick={() => navigate(`/tasks?childId=${selectedChild.id}`)}
            >
              <ListTodo className="w-4 h-4" />
              Manage Tasks
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
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

            {/* Children Cards */}
            <div>
              <h2 className="text-white font-semibold mb-4">Your Children</h2>
              <div className="space-y-4">
                {mockChildren.map((child) => (
                  <ChildCard
                    key={child.id}
                    child={child}
                    isSelected={selectedChild.id === child.id}
                    onClick={setSelectedChild}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Selected Child's Schedule */}
          <div className="lg:col-span-2">
            <Card className="p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{selectedChild.name}'s Schedule</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/tasks?childId=${selectedChild.id}`)}
                  >
                    <ListTodo className="w-4 h-4 mr-1" />
                    Manage Tasks
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/child/${selectedChild.id}`)}
                  >
                    View Child Interface
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                {mockTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    className="hover:shadow-md"
                  />
                ))}
              </div>
              
              {/* Progress Summary */}
              <div className="mt-8 p-4 bg-gradient-secondary rounded-lg text-white">
                <h3 className="font-semibold mb-2">Today's Progress</h3>
                <div className="flex justify-between items-center">
                  <span>Tasks completed: 1/4</span>
                  <span>Coins earned: 5</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                  <div className="bg-white h-full rounded-full w-1/4" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;