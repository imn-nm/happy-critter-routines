import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Award, ArrowLeft, Clock, Gift, Eye, Coins } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import { useTasks } from "@/hooks/useTasks";
import MonthView from "@/components/MonthView";
import TimelineView from "@/components/TimelineView";
import ChildProfileEdit from "@/components/ChildProfileEdit";
import RewardsManagement from "@/components/RewardsManagement";
import { useNavigate } from "react-router-dom";

const ChildReports = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading: childrenLoading, updateChild } = useChildren();
  const { tasks, loading: tasksLoading } = useTasks(childId || undefined);

  const selectedChild = children.find(c => c.id === childId) || null;
  const loading = childrenLoading || tasksLoading;
  const getTasksWithCompletionStatus = () => tasks;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground text-sm">Loading...</p></div>;

  if (!childId || !selectedChild) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-md mx-auto text-center py-16">
          <h2 className="text-xl font-bold text-foreground mb-3">{!childId ? 'No child selected' : 'Child not found'}</h2>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-full">Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const child = selectedChild;

  return (
    <div className="min-h-screen p-4 pb-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/child-dashboard/${child.id}`)} className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground text-glow">{child.name}'s Reports</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/child-dashboard/${child.id}`)}
              className="gap-1.5 rounded-xl"
            >
              <Eye className="w-3.5 h-3.5" />
              Manage
            </Button>
            <ChildProfileEdit child={child} onUpdateChild={updateChild} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Coins", value: child.currentCoins, icon: Award, color: "text-yellow-400" },
            { label: "Happiness", value: `${child.petHappiness}%`, icon: TrendingUp, color: "text-green-400" },
            { label: "Active", value: tasks.filter(t => t.is_active).length, icon: Clock, color: "text-purple-400" },
            { label: "Total", value: tasks.length, icon: Calendar, color: "text-blue-400" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-2.5 sm:p-4 text-center">
              <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mx-auto mb-1`} />
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto glass rounded-2xl p-1">
            <TabsTrigger value="timeline" className="flex items-center gap-1 sm:gap-1.5 py-2.5 text-[11px] sm:text-xs rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <Clock className="w-3.5 h-3.5 hidden sm:block" /> Daily
            </TabsTrigger>
            <TabsTrigger value="month" className="flex items-center gap-1 sm:gap-1.5 py-2.5 text-[11px] sm:text-xs rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <TrendingUp className="w-3.5 h-3.5 hidden sm:block" /> Month
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1 sm:gap-1.5 py-2.5 text-[11px] sm:text-xs rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <Gift className="w-3.5 h-3.5 hidden sm:block" /> Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline"><TimelineView child={child} /></TabsContent>
          <TabsContent value="month">
            <MonthView child={child} tasks={tasks} getTasksWithCompletionStatus={getTasksWithCompletionStatus} />
          </TabsContent>
          <TabsContent value="rewards"><RewardsManagement child={child} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChildReports;
