import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Settings, Sparkles } from "lucide-react";
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

  const childNowNext = useMemo(() => {
    const out: Record<string, { now?: string; next?: string }> = {};
    const now = new Date();
    const today = format(now, "EEEE").toLowerCase();
    const currentTime = format(now, "HH:mm");
    for (const child of children) {
      const tasks = allTasks
        .filter(t => t.child_id === child.id)
        .filter(t => t.scheduled_time && t.is_recurring && t.recurring_days?.includes(today))
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
    const events: Array<{
      id: string;
      name: string;
      time: string;
      date: Date;
      childName: string;
      childId: string;
    }> = [];
    const now = new Date();
    const currentTime = format(now, "HH:mm");
    const systemTasks = ["wake", "breakfast", "school", "lunch", "dinner", "bedtime"];

    for (const task of allTasks) {
      if (!task.scheduled_time || !task.is_recurring || !task.recurring_days?.length) continue;
      if (systemTasks.some(s => task.name.toLowerCase().includes(s))) continue;
      const child = children.find(c => c.id === task.child_id);
      if (!child) continue;
      const time = task.scheduled_time.slice(0, 5);
      for (let offset = 0; offset <= 14; offset++) {
        const date = addDays(now, offset);
        const day = format(date, "EEEE").toLowerCase();
        if (!task.recurring_days.includes(day)) continue;
        if (offset === 0 && time <= currentTime) continue;
        events.push({
          id: `${task.id}-${offset}`,
          name: task.name,
          time,
          date,
          childName: child.name,
          childId: child.id,
        });
      }
    }
    return events
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
          <div className="w-16 h-16 rounded-r-md glass-strong flex items-center justify-center mx-auto mb-5 glow-iris">
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
    <div className="min-h-screen px-sp-2 py-sp-5">
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-3">
        {/* 8px safe-area spacer */}
        <div className="h-sp-2" />

        {/* Header row */}
        <header className="flex items-start justify-between gap-sp-3">
          <div className="flex items-start gap-sp-3 min-w-0">
            <button
              type="button"
              aria-label="Back to child view"
              onClick={() => navigate("/")}
              className="shrink-0 w-[39px] h-[39px] rounded-full border border-white/70 flex items-center justify-center text-fog-50 hover:bg-white/10 transition-colors duration-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-16 text-fog-50">Hi, {firstName}</p>
              <p className="text-20 text-fog-50 leading-none truncate">{dateLabel}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => navigate("/setup")}
            className="shrink-0 w-[39px] h-[39px] rounded-full border border-white/70 flex items-center justify-center text-fog-50 hover:bg-white/10 transition-colors duration-sm"
          >
            <Settings className="w-4 h-4" />
          </button>
        </header>

        {/* Children panel */}
        <section className="bg-black/70 rounded-r-lg p-1">
          {children.map((child, idx) => (
            <div key={child.id}>
              {idx > 0 && <div className="h-px bg-[#6699FF]/25 mx-3" />}
              <ChildRow
                child={child}
                now={childNowNext[child.id]?.now}
                next={childNowNext[child.id]?.next}
                onOpen={() => navigate(`/child-dashboard/${child.id}`)}
              />
            </div>
          ))}
        </section>

        {/* Upcoming events header */}
        <h2 className="text-16 font-medium text-fog-50 px-sp-1">Upcoming events</h2>

        {/* Events list */}
        <section className="flex flex-col gap-sp-2">
          {upcomingEvents.length === 0 ? (
            <div className="rounded-r-lg bg-[#8C94FF]/20 p-sp-4 text-center text-fog-200 text-14">
              No upcoming events in the next two weeks.
            </div>
          ) : (
            upcomingEvents.map(event => (
              <EventCard
                key={event.id}
                time={event.time}
                title={event.name}
                subtitle={formatDateLabel(event.date)}
                badgeName={event.childName}
                badgeColor={childIdToBadge[event.childId]}
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
      className="w-full flex items-center gap-sp-3 p-sp-3 rounded-r-lg text-left hover:bg-white/[0.03] transition-colors duration-sm"
    >
      {/* Pet avatar */}
      <div className="shrink-0 w-14 h-[62px] rounded-r-lg bg-paper flex items-center justify-center overflow-hidden">
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

      {/* Coin chip */}
      <div className="shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-pill border-2 border-iris-400/30">
        <span className="text-[13px] leading-none">🪙</span>
        <span className="text-[13px] font-bold text-fog-50 leading-none">{child.currentCoins}</span>
      </div>
    </button>
  );
}

function EventCard({
  time,
  title,
  subtitle,
  badgeName,
  badgeColor,
}: {
  time: string;
  title: string;
  subtitle: string;
  badgeName: string;
  badgeColor: string;
}) {
  const [hourMin, ampm] = splitTime(time);
  return (
    <div className="flex items-center gap-sp-3 p-sp-4 rounded-r-lg bg-[#8C94FF]/20">
      {/* Time column */}
      <div className="shrink-0 w-11 text-right text-fog-50 leading-tight">
        <div className="text-16">{hourMin}</div>
        <div className="text-14">{ampm}</div>
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px h-9 bg-white/30" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-16 text-fog-50 truncate">{title}</p>
        <p className="text-14 text-[#9EBEFF] truncate">{subtitle}</p>
      </div>

      {/* Child badge */}
      <div className={`shrink-0 h-7 px-3 rounded-pill ${badgeColor} flex items-center`}>
        <span className="text-12 font-medium text-white">{badgeName}</span>
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
