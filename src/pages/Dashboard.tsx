import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, CalendarClock, Plus, Settings, Sparkles, Star, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatTime12 } from "@/utils/formatTime";
import LoadingScreen from "@/components/LoadingScreen";
import { useChildren, type Child } from "@/hooks/useChildren";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/hooks/useTasks";
import { useParentEventsForChildren } from "@/hooks/useParentEvents";
import PetAvatar from "@/components/PetAvatar";
import LoadErrorCard from "@/components/LoadErrorCard";
import OnboardingSlides from "@/components/OnboardingSlides";
import AlertsPanel, { useAlertCount } from "@/components/AlertsPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "motion/react";
import { format, parse, addDays, startOfDay } from "date-fns";
import { getPSTDate } from "@/utils/pstDate";
import { isRestDate } from "@/utils/restDays";
import { tasksOnDate } from "@/utils/startClash";
import { isSystemTaskName } from "@/utils/systemTasks";

// Per-child chip colours on event cards (Figma 390:3407: tinted fill, same-
// colour text). Assigned by the child's position in the list.
const CHILD_CHIPS = [
  "bg-focus-pink/20 text-focus-pink",
  "bg-focus-lime/10 text-focus-lime",
  "bg-focus-mint/20 text-focus-mint",
  "bg-focus-lavender/20 text-focus-lavender",
  "bg-focus-amber/20 text-focus-amber",
  "bg-focus-iris/20 text-focus-iris",
] as const;

const Dashboard = () => {
  const navigate = useNavigate();
  const { children, loading, loadError, refetch: refetchChildren } = useChildren();
  const { user } = useAuth();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [tasksPending, setTasksPending] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const alertCount = useAlertCount();

  // First-run onboarding, once per signed-in parent. Keyed by user id so a
  // second parent on a shared device still gets the intro.
  const onboardingKey = user?.id ? `onboarding_seen:${user.id}` : null;
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!onboardingKey) return;
    try {
      if (!window.localStorage.getItem(onboardingKey)) setShowOnboarding(true);
    } catch {
      /* private mode — just skip the intro rather than showing it every load */
    }
  }, [onboardingKey]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      if (onboardingKey) window.localStorage.setItem(onboardingKey, "1");
    } catch {
      /* ignore storage errors */
    }
  };

  const firstName = useMemo(() => {
    const meta = user?.user_metadata?.full_name as string | undefined;
    if (meta) return meta.split(" ")[0];
    const emailLocal = user?.email?.split("@")[0];
    if (!emailLocal) return "there";
    return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
  }, [user]);

  // Re-render once a minute so a tab left open overnight shows today.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // "Wed, Sep 9": the long form truncated to "Wednesday, Se..." next to the header buttons.
  const dateLabel = useMemo(() => format(now, "EEEE, MMM d"), [now]);

  useEffect(() => {
    if (children.length === 0) return;
    const ids = children.map(c => c.id);
    setTasksPending(true);
    supabase
      .from("tasks")
      .select("*")
      .in("child_id", ids)
      .then(({ data, error }) => {
        if (error) {
          // Keep tasksPending true so rows show a neutral placeholder
          // instead of a misleading "Nothing scheduled".
          console.error("Failed to load tasks:", error);
          return;
        }
        setAllTasks((data || []) as Task[]);
        setTasksPending(false);
      });
  }, [children]);


  const childNowNext = useMemo(() => {
    const out: Record<string, { now?: string; next?: string }> = {};
    // Pacific time, like the child's screen and the alerts.
    const now = getPSTDate();
    const todayStr = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm");
    for (const child of children) {
      if (isRestDate(child, todayStr)) {
        out[child.id] = { now: "Rest day" };
        continue;
      }
      // Today's real times: one-day changes, skipped days and the built-in
      // rows' per-day times all count (they used to be ignored here).
      const tasks = tasksOnDate(allTasks.filter(t => t.child_id === child.id), todayStr, child)
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const current = [...tasks].reverse().find(t => {
        const start = t.scheduled_time!.slice(0, 5);
        if (start > currentTime) return false;
        // Only "Now" while the task is actually in progress — bounded by its
        // duration (default 30 min) so a 7am task doesn't linger all day.
        const [h, m] = start.split(":").map(Number);
        return nowMinutes < h * 60 + m + (t.duration || 30);
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

  // Parent-only appointments (teacher conference, doctor visit) within the
  // same 14-day window the task-derived events use.
  const { events: parentEvents } = useParentEventsForChildren(
    children.map(c => c.id),
    format(new Date(), "yyyy-MM-dd"),
    format(addDays(new Date(), 14), "yyyy-MM-dd"),
  );

  const upcomingEvents = useMemo(() => {
    type Group = {
      id: string;
      name: string;
      time: string;
      date: Date;
      childNames: string[];
      childIds: string[];
      isParentEvent?: boolean;
      allDay?: boolean;
    };
    const grouped = new Map<string, Group>();
    const now = getPSTDate();
    const today = startOfDay(now);
    const horizon = addDays(today, 14);
    const currentTime = format(now, "HH:mm");

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
      // Built-in rows only (exact names): "Pack lunch" is a real event.
      if (isSystemTaskName(task.name)) continue;
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

    // Parent events — no cross-child grouping (each is one appointment).
    for (const ev of parentEvents) {
      const child = children.find(c => c.id === ev.child_id);
      if (!child) continue;
      const date = parse(ev.date, "yyyy-MM-dd", new Date());
      if (date < today || date > horizon) continue;
      const time = ev.time ? ev.time.slice(0, 5) : "00:00";
      const isToday = ev.date === format(now, "yyyy-MM-dd");
      if (isToday && ev.time && time <= currentTime) continue;
      grouped.set(`pe|${ev.id}`, {
        id: `pe|${ev.id}`,
        name: ev.title,
        time,
        date,
        childNames: [child.name],
        childIds: [child.id],
        isParentEvent: true,
        allDay: !ev.time,
      });
    }

    // Parent events (appointments) always make the list — recurring daily
    // tasks would otherwise fill the 5-entry cap days before an appointment
    // later in the window ever surfaces. The cap applies to task entries only.
    const byDateTime = (a: Group, b: Group) =>
      parse(a.time, "HH:mm", a.date).getTime() - parse(b.time, "HH:mm", b.date).getTime();
    const all = Array.from(grouped.values()).sort(byDateTime);
    const appointments = all.filter(g => g.isParentEvent).slice(0, 5);
    const taskEntries = all.filter(g => !g.isParentEvent).slice(0, 5);
    return [...appointments, ...taskEntries].sort(byDateTime);
  }, [allTasks, children, parentEvents]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (children.length === 0 && loadError) {
    return <LoadErrorCard onRetry={refetchChildren} />;
  }

  if (children.length === 0) {
    return (
      <div className="min-h-dvh bg-focus-bg p-4">
        {/* No children yet — the intro ends by sending them into setup. */}
        <OnboardingSlides
          open={showOnboarding}
          onDone={dismissOnboarding}
          finishLabel="Add Your Child"
          onFinish={() => navigate("/setup")}
        />
        {/* Settings (household, PIN, sign out) is reachable before any child
            exists; it used to be a dead end with no way out. */}
        <div className="max-w-sm mx-auto flex justify-end">
          <button
            type="button"
            aria-label="Settings"
            onClick={() => navigate("/settings")}
            className="w-11 h-11 rounded-[14px] bg-focus-surface text-focus-muted hover:text-focus-text flex items-center justify-center"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="max-w-sm mx-auto text-center pt-16">
          <div className="w-16 h-16 rounded-[20px] bg-focus-surface flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-focus-lavender" />
          </div>
          <h1 className="text-24 font-bold text-focus-text mb-2">Welcome to PetPals!</h1>
          <p className="text-focus-muted text-14 mb-6">Add your first child to get started.</p>
          <Button size="lg" onClick={() => navigate("/setup")} className="gap-2">
            <Plus className="w-5 h-5" />
            Add Your First Child
          </Button>
          <p className="text-12 text-focus-muted mt-5 max-w-[16rem] mx-auto">
            Joining a family that's already set up? Open the invite link you were sent instead.
          </p>
        </div>
      </div>
    );
  }

  const childIdToBadge: Record<string, string> = {};
  children.forEach((c, i) => {
    childIdToBadge[c.id] = CHILD_CHIPS[i % CHILD_CHIPS.length];
  });

  return (
    <div className="min-h-dvh bg-focus-bg pb-sp-5">
      <OnboardingSlides open={showOnboarding} onDone={dismissOnboarding} />
      <div className="max-w-[420px] mx-auto flex flex-col gap-3 px-5 pt-5">
        {/* Header (Figma 390:3515) — alerts on the left, ••• on the right. */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            aria-label={`Alerts${alertCount > 0 ? ` (${alertCount})` : ''}`}
            onClick={() => setShowAlerts(true)}
            className="relative h-11 w-11 inline-flex items-center justify-center rounded-[16px] bg-focus-surface text-focus-iris hover:bg-focus-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            <Bell className="w-5 h-5" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-focus-alert text-12 font-bold text-focus-bg leading-none">
                {alertCount}
              </span>
            )}
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="More"
              className="h-11 w-11 inline-flex items-center justify-center rounded-[14px] bg-focus-surface text-[12px] font-semibold leading-[14px] text-focus-muted hover:bg-focus-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            >
              •••
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuItem onSelect={() => navigate("/")}>
                <Users aria-hidden />
                Kids&apos; Screen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/setup")}>
                <Plus aria-hidden />
                Add Child
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/settings")}>
                <Settings aria-hidden />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Greeting row (Figma 390:3523) */}
        <div className="flex flex-col">
          <h1 className="text-[22px] leading-[28px] font-semibold text-focus-text truncate">Hi, {firstName}</h1>
          <p className="text-[13px] leading-[18px] text-focus-muted">{dateLabel} · Today</p>
        </div>

        {/* Child cards (Figma 390:3599) */}
        <section aria-label="Children" className="flex flex-col gap-2">
          {children.map(child => (
            <ChildRow
              key={child.id}
              child={child}
              now={childNowNext[child.id]?.now}
              next={childNowNext[child.id]?.next}
              pending={tasksPending}
              onOpen={() => navigate(`/child-dashboard/${child.id}`)}
            />
          ))}
        </section>

        {/* Upcoming events (Figma 390:3629 / 390:3631) */}
        <h2 className="pt-1 text-16 leading-[22px] font-semibold text-focus-text">Upcoming Events</h2>
        <section className="flex flex-col gap-2 pb-sp-5">
          {upcomingEvents.length === 0 ? (
            <div className="rounded-[16px] bg-focus-surface px-[14px] py-3 text-13 text-focus-muted">
              No upcoming events in the next two weeks.
            </div>
          ) : (
            upcomingEvents.map(event => (
              <EventCard
                key={event.id}
                time={event.time}
                title={event.name}
                dateLabel={formatDateLabel(event.date)}
                badges={event.childIds.map((cid, i) => ({
                  name: event.childNames[i],
                  color: childIdToBadge[cid],
                }))}
                isParentEvent={event.isParentEvent}
                allDay={event.allDay}
              />
            ))
          )}
        </section>
      </div>

      <AlertsPanel open={showAlerts} onClose={() => setShowAlerts(false)} />
    </div>
  );
};

function ChildRow({
  child,
  now,
  next,
  pending,
  onOpen,
}: {
  child: Child;
  now?: string;
  next?: string;
  pending?: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-stretch gap-3 p-3 rounded-[18px] bg-focus-sheet text-left hover:bg-focus-sunken/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
    >
      {/* Pet */}
      <div className="shrink-0 w-14 min-h-[62px] rounded-[28px] bg-focus-sunken flex items-center justify-center overflow-hidden">
        <PetAvatar petType={child.petType} happiness={child.petHappiness} outfit={child.pet_outfit} size="sm" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <p className="text-20 leading-tight text-focus-text truncate">{child.name}</p>
        <p className="text-12 font-medium text-[#9ebeff] truncate">
          Now: {now || (pending ? "—" : "Nothing scheduled")}
        </p>
        <p className="text-12 font-medium text-[#9ebeff] truncate">
          Next: {next || "—"}
        </p>
      </div>

      {/* Stars */}
      <div className="self-start shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-focus-iris/30 text-13 text-focus-text">
        <Star className="w-3.5 h-3.5 text-focus-lime fill-focus-lime" strokeWidth={0} aria-hidden />
        <span className="font-bold leading-none">{child.currentCoins}</span>
        <span className="sr-only">stars</span>
      </div>
    </motion.button>
  );
}

function EventCard({
  time,
  title,
  dateLabel,
  badges,
  isParentEvent,
  allDay,
}: {
  time: string;
  title: string;
  dateLabel: string;
  badges: { name: string; color: string }[];
  isParentEvent?: boolean;
  allDay?: boolean;
}) {
  const [hourMin, ampm] = splitTime(time);
  const when = allDay ? `${dateLabel} · All day` : `${dateLabel} · ${hourMin} ${ampm}`;
  return (
    <div className="flex items-start gap-[10px] rounded-[16px] bg-focus-surface px-[14px] py-3">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-[15px] leading-5 font-semibold text-focus-text flex items-center gap-1.5 min-w-0">
          {/* Calendar icon marks a parent-only appointment */}
          {isParentEvent && <CalendarClock className="w-4 h-4 text-focus-iris shrink-0" aria-label="Parent appointment" />}
          <span className="truncate">{title}</span>
        </p>
        <p className="text-12 leading-4 text-focus-muted truncate">{when}</p>
      </div>
      <div className="shrink-0 flex flex-wrap items-center justify-end gap-1 max-w-[50%]">
        {badges.map(b => (
          <span key={b.name} className={`h-[26px] inline-flex items-center px-2 rounded-full text-12 font-semibold leading-4 ${b.color}`}>
            {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// Same "9:39pm" style as every other screen; this used to print "9:39PM".
function formatTime(sql: string): string {
  return formatTime12(sql);
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
