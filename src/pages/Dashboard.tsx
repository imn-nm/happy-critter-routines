import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Plus, Settings, Sparkles, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChildren, type Child } from "@/hooks/useChildren";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/hooks/useTasks";
import PetAvatar from "@/components/PetAvatar";
import { format, parse, addDays, startOfDay } from "date-fns";

const BADGE_COLORS = ["bg-mint-500", "bg-iris-500", "bg-lilac-500", "bg-amber-500", "bg-coral-500"] as const;

const Dashboard = () => {
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [pendingAlerts, setPendingAlerts] = useState<{ childId: string; rewardName: string; id: string; coins: number }[]>([]);

  const firstName = useMemo(() => {
    const meta = user?.user_metadata?.full_name as string | undefined;
    if (meta) return meta.split(" ")[0];
    const emailLocal = user?.email?.split("@")[0];
    if (!emailLocal) return "there";
    return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
  }, [user]);

  const dateLabel = useMemo(() => format(new Date(), "EEEE, MMMM d"), []);

  useEffect(() => {
    if (children.length === 0) return;
    const ids = children.map(c => c.id);
    supabase
      .from("tasks")
      .select("*")
      .in("child_id", ids)
      .then(({ data }) => setAllTasks((data || []) as Task[]));
  }, [children]);

  // Fetch pending reward requests across all children
  useEffect(() => {
    if (children.length === 0) return;
    const ids = children.map(c => c.id);
    supabase
      .from("reward_purchases")
      .select("id, child_id, reward_id, coins_spent, status")
      .in("child_id", ids)
      .eq("status", "pending")
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setPendingAlerts([]); return; }
        // Fetch reward names
        const rewardIds = [...new Set(data.map(p => p.reward_id))];
        const { data: rewards } = await supabase.from("rewards").select("id, name").in("id", rewardIds);
        const rewardMap = new Map((rewards || []).map(r => [r.id, r.name]));
        setPendingAlerts(data.map(p => ({
          id: p.id,
          childId: p.child_id,
          rewardName: rewardMap.get(p.reward_id) || "Reward",
          coins: p.coins_spent,
        })));
      });
  }, [children]);

  const childNowNext = useMemo(() => {
    const out: Record<string, { now?: string; next?: string }> = {};
    const now = new Date();
    const today = format(now, "EEEE").toLowerCase();
    const todayStr = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm");
    for (const child of children) {
      const tasks = allTasks
        .filter(t => t.child_id === child.id)
        .filter(t => {
          // Recurring tasks scheduled for today
          if (t.is_recurring && t.recurring_days?.includes(today)) return true;
          // Non-recurring tasks pinned to today's date (chores, one-off tasks)
          if (!t.is_recurring && t.task_date === todayStr) return true;
          return false;
        })
        .map(t => {
          // Chores use window_start as their display time
          if (!t.scheduled_time && t.window_start) {
            return { ...t, scheduled_time: t.window_start };
          }
          return t;
        })
        .filter(t => t.scheduled_time)
        .sort((a, b) => a.scheduled_time!.localeCompare(b.scheduled_time!));

      const current = [...tasks].reverse().find(t => {
        const start = t.scheduled_time!.slice(0, 5);
        return start <= currentTime;
      });
      const next = tasks.find(t => t.scheduled_time!.slice(0, 5) > currentTime);
      const fmt = (t?: Task) => {
        if (!t) return undefined;
        const time = formatTime(t.scheduled_time!);
        return `${t.name} at ${time}`;
      };
      out[child.id] = { now: current?.name ?? undefined, next: fmt(next) };
    }
    return out;
  }, [allTasks, children]);

  const upcomingEvents = useMemo(() => {
    type Group = {
      id: string;
      name: string;
      time: string;
      date: Date;
      childNames: string[];
      childIds: string[];
    };
    const grouped = new Map<string, Group>();
    const now = new Date();
    const today = startOfDay(now);
    const horizon = addDays(today, 14);
    const currentTime = format(now, "HH:mm");
    const systemTasks = ["wake", "breakfast", "school", "lunch", "dinner", "bedtime"];

    const addGroup = (date: Date, time: string, name: string, child: Child) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const groupKey = `${name.toLowerCase()}|${dateKey}|${time}`;
      const existing = grouped.get(groupKey);
      if (existing) {
        if (!existing.childIds.includes(child.id)) {
          existing.childIds.push(child.id);
          existing.childNames.push(child.name);
        }
      } else {
        grouped.set(groupKey, {
          id: groupKey,
          name,
          time,
          date,
          childNames: [child.name],
          childIds: [child.id],
        });
      }
    };

    for (const task of allTasks) {
      if (task.is_active === false) continue;
      if (!task.scheduled_time) continue;
      if (systemTasks.some(s => task.name.toLowerCase().includes(s))) continue;
      const child = children.find(c => c.id === task.child_id);
      if (!child) continue;
      const time = task.scheduled_time.slice(0, 5);

      if (task.is_recurring && task.recurring_days?.length) {
        for (let offset = 0; offset <= 14; offset++) {
          const date = addDays(now, offset);
          const day = format(date, "EEEE").toLowerCase();
          const dateKey = format(date, "yyyy-MM-dd");
          if (!task.recurring_days.includes(day)) continue;
          if (task.excluded_dates?.includes(dateKey)) continue;
          if (offset === 0 && time <= currentTime) continue;
          addGroup(date, time, task.name, child);
        }
      } else if (!task.is_recurring && task.task_date) {
        const date = parse(task.task_date, "yyyy-MM-dd", new Date());
        if (date < today || date > horizon) continue;
        const isToday = format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
        if (isToday && time <= currentTime) continue;
        addGroup(date, time, task.name, child);
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => parse(a.time, "HH:mm", a.date).getTime() - parse(b.time, "HH:mm", b.date).getTime())
      .slice(0, 5);
  }, [allTasks, children]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">Loading dashboard…</div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-sm mx-auto text-center pt-24">
          <div className="w-16 h-16 rounded-[20px] glass-strong flex items-center justify-center mx-auto mb-5 glow-iris">
            <Sparkles className="w-7 h-7 text-iris-300" />
          </div>
          <h1 className="text-2xl font-bold text-fog-50 mb-2 text-glow">Welcome to Routines!</h1>
          <p className="text-fog-200 text-sm mb-6">Add your first child to get started.</p>
          <Button size="lg" onClick={() => navigate("/setup")} className="gap-2">
            <Plus className="w-5 h-5" />
            Add Your First Child
          </Button>
        </div>
      </div>
    );
  }

  const childIdToBadge: Record<string, string> = {};
  children.forEach((c, i) => {
    childIdToBadge[c.id] = BADGE_COLORS[i % BADGE_COLORS.length];
  });

  return (
    <div className="min-h-screen pb-sp-5">
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-3">
        {/* Hero panel — iris-tinted, rounded-bottom; wraps the header row +
            children list together. Matches Figma node 174:7514. */}
        <div className="bg-iris-400/[0.35] rounded-b-[36px] px-sp-4 pt-sp-5 pb-sp-4 flex flex-col gap-sp-3">
          {/* Header row — greeting/date left, settings pill right */}
          <header className="flex items-end justify-between gap-sp-3">
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-16 text-white">Hi, {firstName}</p>
              <p className="text-20 text-white leading-none truncate">{dateLabel}</p>
            </div>
            <div className="shrink-0 flex items-center gap-sp-2">
              <button
                type="button"
                aria-label="Exit parent dashboard"
                onClick={() => navigate("/")}
                className="h-9 px-sp-3 rounded-pill bg-iris-400/[0.04] border border-iris-400/30 flex items-center gap-1.5 text-fog-50 text-14 hover:bg-iris-400/10 transition-colors duration-sm"
              >
                <LogOut className="w-4 h-4" />
                Exit
              </button>
              {pendingAlerts.length > 0 && (
                <button
                  type="button"
                  aria-label={`${pendingAlerts.length} pending alert${pendingAlerts.length > 1 ? 's' : ''}`}
                  onClick={() => {
                    // Navigate to the first child with a pending request
                    const firstChildId = pendingAlerts[0]?.childId;
                    if (firstChildId) navigate(`/child-dashboard/${firstChildId}`);
                  }}
                  className="relative w-9 h-9 rounded-pill bg-iris-400/[0.04] border border-iris-400/30 flex items-center justify-center text-fog-50 hover:bg-iris-400/10 transition-colors duration-sm"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-coral-400 text-[10px] font-bold text-white leading-none">
                    {pendingAlerts.length}
                  </span>
                </button>
              )}
              <button
                type="button"
                aria-label="Settings"
                onClick={() => navigate("/settings")}
                className="w-9 h-9 rounded-pill bg-iris-400/[0.04] border border-iris-400/30 flex items-center justify-center text-fog-50 hover:bg-iris-400/10 transition-colors duration-sm"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Children panel — bordered iris-400/25, child cards stacked with
              a horizontal rule between them. */}
          <section className="border border-iris-400/[0.25] rounded-[28px] p-sp-4 flex flex-col gap-sp-1">
            {children.map((child, idx) => (
              <div key={child.id}>
                {idx > 0 && <div className="h-px bg-iris-400/25 mb-sp-1" />}
                <ChildRow
                  child={child}
                  now={childNowNext[child.id]?.now}
                  next={childNowNext[child.id]?.next}
                  onOpen={() => navigate(`/child-dashboard/${child.id}`)}
                />
              </div>
            ))}
          </section>
        </div>

        {/* Upcoming events header */}
        <h2 className="text-16 font-medium text-white px-sp-4">Upcoming events</h2>

        {/* Events list */}
        <section className="px-sp-4 flex flex-col gap-sp-2">
          {upcomingEvents.length === 0 ? (
            <div className="rounded-[28px] bg-[#8C94FF]/20 p-sp-4 text-center text-fog-200 text-14">
              No upcoming events in the next two weeks.
            </div>
          ) : (
            upcomingEvents.map(event => (
              <EventCard
                key={event.id}
                time={event.time}
                title={event.name}
                subtitle={formatDateLabel(event.date)}
                badges={event.childIds.map((cid, i) => ({
                  name: event.childNames[i],
                  color: childIdToBadge[cid],
                }))}
              />
            ))
          )}
        </section>

      </div>
    </div>
  );
};

function ChildRow({
  child,
  now,
  next,
  onOpen,
}: {
  child: Child;
  now?: string;
  next?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-sp-3 p-sp-3 rounded-[28px] text-left hover:bg-white/[0.03] transition-colors duration-sm"
    >
      {/* Pet avatar */}
      <div className="shrink-0 w-14 h-[62px] rounded-[28px] bg-paper flex items-center justify-center overflow-hidden">
        <PetAvatar petType={child.petType} happiness={child.petHappiness} size="sm" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-20 text-fog-50 leading-none truncate">{child.name}</p>
        <p className="text-12 font-medium text-[#9EBEFF] truncate">
          Now: {now || "Nothing scheduled"}
        </p>
        <p className="text-12 font-medium text-[#9EBEFF] truncate">
          Next: {next || "—"}
        </p>
      </div>

      {/* Star chip — same gold star + count used on the child interface */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
        <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
        <span className="text-13 font-bold text-fog-50 leading-none">{child.currentCoins}</span>
      </div>
    </button>
  );
}

function EventCard({
  time,
  title,
  subtitle,
  badges,
}: {
  time: string;
  title: string;
  subtitle: string;
  badges: { name: string; color: string }[];
}) {
  const [hourMin, ampm] = splitTime(time);
  return (
    <div className="flex items-center gap-sp-3 p-sp-4 rounded-[28px] bg-[#8C94FF]/20">
      {/* Time column — stacked hour + am/pm, both 12px (Figma 174:7504) */}
      <div className="shrink-0 w-11 text-right text-white leading-tight flex flex-col">
        <span className="text-12">{hourMin}</span>
        <span className="text-12">{ampm}</span>
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px self-stretch bg-white/30" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-16 text-white truncate">{title}</p>
        <p className="text-12 text-[#9EBEFF] truncate">{subtitle}</p>
      </div>

      {/* Child badges — one solid pill per child sharing this slot */}
      <div className="shrink-0 flex flex-wrap items-center justify-end gap-1">
        {badges.map(b => (
          <div key={b.name} className={`px-3 py-1.5 rounded-pill ${b.color} flex items-center`}>
            <span className="text-12 font-medium text-white">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(sql: string): string {
  const [h, m] = sql.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m}${ampm}`;
}

function splitTime(hhmm: string): [string, string] {
  const [h, m] = hhmm.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return [`${display}:${m}`, ampm];
}

function formatDateLabel(date: Date): string {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const d = startOfDay(date);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export default Dashboard;
