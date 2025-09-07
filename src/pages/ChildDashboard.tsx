import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ListTodo, Gift, Calendar } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import RewardsManagement from "@/components/RewardsManagement";
import TimelineScheduleView from "@/components/TimelineScheduleView";

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const [child, setChild] = useState(null);

  useEffect(() => {
    if (children.length > 0 && childId) {
      const foundChild = children.find(c => c.id === childId);
      setChild(foundChild || null);
    }
  }, [children, childId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8 text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold text-white mb-4">Child not found</h1>
            <Button onClick={() => navigate("/dashboard")} variant="accent">
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
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">
            {child.name}'s Dashboard
          </h1>
        </div>

        {/* Child Summary Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{child.name}</h2>
              <p className="text-muted-foreground">Age: {child.age || 'Not specified'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Current Coins</p>
                <p className="text-2xl font-bold text-warning">{child.currentCoins}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pet Happiness</p>
                <p className="text-2xl font-bold text-success">{child.petHappiness}%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Management Tabs */}
        <Tabs defaultValue="tasks" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule & Tasks
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Rewards Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <TimelineScheduleView child={child} />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardsManagement child={child} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChildDashboard;