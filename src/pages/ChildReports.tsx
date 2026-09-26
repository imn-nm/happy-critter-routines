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
  const { children, loading: childrenLoading, updateChild, updateChildCoins } = useChildren();
  const { tasks, loading: tasksLoading } = useTasks(childId || undefined);

  const selectedChild = children.find(c => c.id === childId) || null;
  const loading = childrenLoading || tasksLoading;
  const getTasksWithCompletionStatus = () => tasks;

  if (loading) return <div className="min-h-dvh flex items-center justify-center"><p className="text-focus-muted text-14">Loading...</p></div>;

  if (!childId || !selectedChild) {
    return (
      <div className="min-h-dvh p-4">
        <div className="max-w-md mx-auto text-center py-16">
          <h2 className="text-20 font-bold text-focus-text mb-3">{!childId ? 'No child selected' : 'Child not found'}</h2>
          <Button variant="outline" onClick={() => navigate("/parent")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const child = selectedChild;

  return (
    <div className="min-h-dvh p-4 pb-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" onClick={() => navigate(`/child-dashboard/${child.id}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-20 font-bold text-focus-text">{child.name}'s Reports</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/child-dashboard/${child.id}`)}
              className="gap-1.5"
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
            { label: "Coins", value: child.currentCoins, icon: Award, color: "text-focus-amber" },
            { label: "Happiness", value: `${child.petHappiness}%`, icon: TrendingUp, color: "text-focus-mint" },
            { label: "Active", value: tasks.filter(t => t.is_active).length, icon: Clock, color: "text-focus-lavender" },
            { label: "Total", value: tasks.length, icon: Calendar, color: "text-focus-iris" },
          ].map((stat) => (
            <div key={stat.label} className="bg-focus-surface rounded-[24px] p-2.5 sm:p-4 text-center">
              <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} mx-auto mb-1`} />
              <p className="text-18 sm:text-24 font-bold text-focus-text">{stat.value}</p>
              <p className="text-12 text-focus-muted mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline" className="flex items-center gap-1 sm:gap-1.5 text-13 sm:text-14">
              <Clock className="w-3.5 h-3.5 hidden sm:block" /> Daily
            </TabsTrigger>
            <TabsTrigger value="month" className="flex items-center gap-1 sm:gap-1.5 text-13 sm:text-14">
              <TrendingUp className="w-3.5 h-3.5 hidden sm:block" /> Month
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1 sm:gap-1.5 text-13 sm:text-14">
              <Gift className="w-3.5 h-3.5 hidden sm:block" /> Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline"><TimelineView child={child} /></TabsContent>
          <TabsContent value="month">
            <MonthView child={child} tasks={tasks} getTasksWithCompletionStatus={getTasksWithCompletionStatus} />
          </TabsContent>
          <TabsContent value="rewards"><RewardsManagement child={child} onUpdateCoins={updateChildCoins} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChildReports;
