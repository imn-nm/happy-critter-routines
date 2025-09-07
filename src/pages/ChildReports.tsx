import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Award, ArrowLeft, Clock, Settings, Gift } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import MonthView from "@/components/MonthView";
import WeekView from "@/components/WeekView";
import TimelineView from "@/components/TimelineView";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import RewardsManagement from "@/components/RewardsManagement";
import { useNavigate } from "react-router-dom";

const ChildReports = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const childId = searchParams.get("childId");
  const { children, loading: childrenLoading } = useChildren();
  const { tasks, loading: tasksLoading } = useTasks(childId || undefined);
  const [selectedChild, setSelectedChild] = useState<any>(null);

  const loading = childrenLoading || tasksLoading;

  useEffect(() => {
    if (children.length > 0 && childId) {
      const child = children.find(c => c.id === childId);
      setSelectedChild(child);
    }
  }, [children, childId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8 text-white">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!childId) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-white mb-4">No Child Selected</h2>
            <p className="text-white/80 mb-8">Please select a child to view their reports.</p>
            <Button 
              variant="accent" 
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const child = selectedChild;
  if (!child) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-white mb-4">Child Not Found</h2>
            <p className="text-white/80 mb-8">The selected child could not be found.</p>
            <Button 
              variant="accent" 
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
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
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-white">
              {child ? `${child.name}'s Dashboard` : 'Child Dashboard'}
            </h1>
          </div>
          
          {child && (
            <div className="flex gap-2">
              <ChildProfileEdit child={child} />
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Coins</p>
                <p className="text-2xl font-bold">{child.currentCoins}</p>
              </div>
              <Award className="w-8 h-8 text-warning" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pet Happiness</p>
                <p className="text-2xl font-bold">{child.petHappiness}%</p>
              </div>
              <Calendar className="w-8 h-8 text-success" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.is_active).length}</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-info" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="bg-white/90 backdrop-blur">
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Daily Timeline
            </TabsTrigger>
            <TabsTrigger value="week" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Week View
            </TabsTrigger>
            <TabsTrigger value="month" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Month View
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <TimelineView child={child} />
          </TabsContent>

          <TabsContent value="week">
            <WeekView 
              child={child} 
              tasks={tasks}
              onTasksReorder={() => {}}
              onEditTask={() => {}}
              onDeleteTask={() => {}}
            />
          </TabsContent>

          <TabsContent value="month">
            <MonthView child={child} tasks={tasks} />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardsManagement child={child} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChildReports;