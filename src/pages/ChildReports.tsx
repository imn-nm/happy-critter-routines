import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, BarChart3 } from 'lucide-react';
import { useChildren } from '@/hooks/useChildren';
import WeekView from '@/components/WeekView';
import MonthView from '@/components/MonthView';
import ChildCard, { type Child } from "@/components/ChildCard";

const ChildReports = () => {
  const navigate = useNavigate();
  const { childId } = useParams();
  const { children, loading } = useChildren();
  const [selectedView, setSelectedView] = useState<'week' | 'month'>('week');

  const selectedChild = children.find(child => child.id === childId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8 text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8 text-white">Child not found</div>
          <div className="text-center">
            <Button variant="accent" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-white">Progress Reports</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Child Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <ChildCard
                child={selectedChild}
                isSelected={true}
                onClick={() => {}}
                className="hover:scale-100"
              />
              
              {/* Quick Actions */}
              <div className="space-y-2">
                <Button
                  variant="accent"
                  className="w-full justify-start"
                  onClick={() => navigate(`/tasks?childId=${selectedChild.id}`)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Manage Tasks
                </Button>
                <Button
                  variant="gradientSecondary"
                  className="w-full justify-start"
                  onClick={() => navigate(`/child/${selectedChild.id}`)}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Child Interface
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as 'week' | 'month')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="week" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Week View
                </TabsTrigger>
                <TabsTrigger value="month" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Month View
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="week">
                <WeekView child={selectedChild} />
              </TabsContent>
              
              <TabsContent value="month">
                <MonthView child={selectedChild} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildReports;