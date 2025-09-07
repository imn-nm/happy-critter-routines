import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';

interface WeekViewProps {
  child: Child;
}

interface DayData {
  date: Date;
  completions: number;
  coinsEarned: number;
  tasksCompleted: string[];
}

const WeekView = ({ child }: WeekViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Start on Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const fetchWeekData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select(`
          *,
          tasks!inner(name)
        `)
        .eq('child_id', child.id)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      const dayDataMap = new Map<string, DayData>();
      
      // Initialize all days
      weekDays.forEach(day => {
        dayDataMap.set(format(day, 'yyyy-MM-dd'), {
          date: day,
          completions: 0,
          coinsEarned: 0,
          tasksCompleted: [],
        });
      });

      // Fill in completion data
      data?.forEach(completion => {
        const dateKey = completion.date;
        const dayData = dayDataMap.get(dateKey);
        if (dayData) {
          dayData.completions++;
          dayData.coinsEarned += completion.coins_earned;
          dayData.tasksCompleted.push((completion as any).tasks.name);
        }
      });

      setWeekData(Array.from(dayDataMap.values()));
    } catch (error) {
      console.error('Error fetching week data:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  const getTotalWeekStats = () => {
    return weekData.reduce(
      (acc, day) => ({
        totalCompletions: acc.totalCompletions + day.completions,
        totalCoins: acc.totalCoins + day.coinsEarned,
      }),
      { totalCompletions: 0, totalCoins: 0 }
    );
  };

  const getMaxCompletions = () => {
    return Math.max(...weekData.map(day => day.completions), 1);
  };

  useEffect(() => {
    fetchWeekData();
  }, [child.id, currentWeek]);

  const { totalCompletions, totalCoins } = getTotalWeekStats();
  const maxCompletions = getMaxCompletions();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold">Week View - {child.name}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentWeek}
            className="text-sm"
          >
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-4">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-xl font-bold">{totalCompletions}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Coins Earned</p>
              <p className="text-xl font-bold">{totalCoins}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Daily Average</p>
            <p className="text-xl font-bold">{(totalCompletions / 7).toFixed(1)}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Active Days</p>
            <p className="text-xl font-bold">{weekData.filter(day => day.completions > 0).length}/7</p>
          </div>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading week data...</div>
        ) : (
          weekData.map((dayData) => (
            <Card 
              key={format(dayData.date, 'yyyy-MM-dd')} 
              className={`p-4 ${isSameDay(dayData.date, new Date()) ? 'ring-2 ring-primary' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-medium">{format(dayData.date, 'EEE')}</p>
                    <p className="text-lg font-bold">{format(dayData.date, 'd')}</p>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-sm text-muted-foreground">
                        {dayData.completions} tasks completed
                      </span>
                      <span className="text-sm font-medium text-warning">
                        {dayData.coinsEarned} coins
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(dayData.completions / maxCompletions) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {dayData.tasksCompleted.length > 0 && (
                  <div className="text-right max-w-xs">
                    <p className="text-xs text-muted-foreground mb-1">Tasks completed:</p>
                    <div className="flex flex-wrap gap-1">
                      {dayData.tasksCompleted.slice(0, 3).map((taskName, index) => (
                        <span key={index} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {taskName}
                        </span>
                      ))}
                      {dayData.tasksCompleted.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{dayData.tasksCompleted.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </Card>
  );
};

export default WeekView;