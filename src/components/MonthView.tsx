import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, Award, Target, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, getDay } from 'date-fns';
import { Child } from '@/hooks/useChildren';
import { Task } from '@/hooks/useTasks';

interface MonthViewProps {
  child: Child;
  tasks: Task[];
}

interface DayData {
  date: Date;
  completions: number;
  coinsEarned: number;
  isCurrentMonth: boolean;
  scheduledTasks: Task[];
}

const MonthView = ({ child, tasks }: MonthViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get calendar grid (including days from previous and next month)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - getDay(monthStart) + 1); // Start from Monday
  
  const calendarEnd = new Date(monthEnd);
  const remainingDays = 7 - getDay(monthEnd);
  if (remainingDays < 7) {
    calendarEnd.setDate(calendarEnd.getDate() + remainingDays);
  }
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('child_id', child.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      const dayDataMap = new Map<string, DayData>();
      
      // Initialize all calendar days with scheduled tasks
      calendarDays.forEach(day => {
        const dayTasks = tasks?.filter(task => {
          // For this demo, show all tasks on all days
          // In real implementation, you'd filter by recurring_days or specific dates
          return task.is_active;
        }) || [];
        
        dayDataMap.set(format(day, 'yyyy-MM-dd'), {
          date: day,
          completions: 0,
          coinsEarned: 0,
          isCurrentMonth: isSameMonth(day, currentMonth),
          scheduledTasks: dayTasks,
        });
      });

      // Fill in completion data
      data?.forEach(completion => {
        const dateKey = completion.date;
        const dayData = dayDataMap.get(dateKey);
        if (dayData) {
          dayData.completions++;
          dayData.coinsEarned += completion.coins_earned;
        }
      });

      setMonthData(Array.from(dayDataMap.values()));
    } catch (error) {
      console.error('Error fetching month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  const getMonthStats = () => {
    const currentMonthData = monthData.filter(day => day.isCurrentMonth);
    const totalCompletions = currentMonthData.reduce((sum, day) => sum + day.completions, 0);
    const totalCoins = currentMonthData.reduce((sum, day) => sum + day.coinsEarned, 0);
    const activeDays = currentMonthData.filter(day => day.completions > 0).length;
    const daysInMonth = currentMonthData.length;
    const totalScheduledTasks = currentMonthData.reduce((sum, day) => sum + day.scheduledTasks.length, 0);
    
    return {
      totalCompletions,
      totalCoins,
      activeDays,
      daysInMonth,
      totalScheduledTasks,
      averagePerDay: totalCompletions / daysInMonth,
      consistencyRate: (activeDays / daysInMonth) * 100,
    };
  };

  const getCompletionLevel = (completions: number) => {
    if (completions === 0) return 'bg-muted';
    if (completions <= 2) return 'bg-green-200';
    if (completions <= 4) return 'bg-green-400';
    if (completions <= 6) return 'bg-green-600';
    return 'bg-green-800';
  };

  useEffect(() => {
    fetchMonthData();
  }, [child.id, currentMonth]);

  const stats = getMonthStats();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold">Month View - {child.name}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentMonth}
            className="text-sm"
          >
            This Month
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold px-4">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-xl font-bold">{stats.totalCompletions}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Coins Earned</p>
              <p className="text-xl font-bold">{stats.totalCoins}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-info" />
            <div>
              <p className="text-sm text-muted-foreground">Scheduled</p>
              <p className="text-xl font-bold">{stats.totalScheduledTasks}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Daily Average</p>
              <p className="text-xl font-bold">{stats.averagePerDay.toFixed(1)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Consistency</p>
              <p className="text-xl font-bold">{stats.consistencyRate.toFixed(0)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading month data...</div>
      ) : (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {monthData.map((dayData) => (
              <div
                key={format(dayData.date, 'yyyy-MM-dd')}
                className={`
                  relative p-2 min-h-[60px] border rounded-lg transition-all hover:shadow-sm
                  ${dayData.isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
                  ${isSameDay(dayData.date, new Date()) ? 'ring-2 ring-primary' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${dayData.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {format(dayData.date, 'd')}
                  </span>
                  {dayData.completions > 0 && (
                    <div
                      className={`w-3 h-3 rounded-full ${getCompletionLevel(dayData.completions)}`}
                      title={`${dayData.completions} tasks completed`}
                    />
                  )}
                </div>
                
                {dayData.isCurrentMonth && (
                  <div className="space-y-1">
                    {dayData.scheduledTasks.length > 0 && (
                      <div className="text-xs text-info">
                        {dayData.scheduledTasks.length} scheduled
                      </div>
                    )}
                    {dayData.completions > 0 && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {dayData.completions} completed
                        </div>
                        {dayData.coinsEarned > 0 && (
                          <div className="text-xs font-medium text-warning">
                            {dayData.coinsEarned} coins
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted"></div>
              <span>No tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-200"></div>
              <span>1-2 tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <span>3-4 tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span>5-6 tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-800"></div>
              <span>7+ tasks</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default MonthView;