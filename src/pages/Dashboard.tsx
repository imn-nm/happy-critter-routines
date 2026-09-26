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
import { format, parse, addDays, startOfDay } from "date-fns";
import { getPSTDate } from "@/utils/pstDate";
import { isRestDate } from "@/utils/restDays";
import { tasksOnDate } from "@/utils/startClash";
import { isSystemTaskName } from "@/utils/systemTasks";

const BADGE_COLORS = ["bg-focus-mint", "bg-focus-lavender", "bg-focus-pink", "bg-focus-amber", "bg-focus-iris"] as const;

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
  const dateLabel = useMemo(() => format(now, "EEE, MMM d"), [now]);

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
    childIdToBadge[c.id] = BADGE_COLORS[i % BADGE_COLORS.length];
  });

  return (
    <div className="min-h-dvh bg-focus-bg pb-sp-5">
      <OnboardingSlides open={showOnboarding} onDone={dismissOnboarding} />
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-3">
        {/* Header + children list on the flat page (Focus design system). */}
        <div className="px-sp-4 pt-sp-5 flex flex-col gap-sp-3">
          {/* Header row — greeting/date left, settings pill right */}
          <header className="flex items-end justify-between gap-sp-3">
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-14 text-focus-muted">Hi, {firstName}</p>
              <p className="text-24 font-bold text-focus-text leading-none truncate">{dateLabel}</p>
            </div>
            <div className="shrink-0 flex items-center gap-sp-2">
              <button
                type="button"
                aria-label="Switch to the kids' screen"
                onClick={() => navigate("/")}
                className="h-11 px-sp-3 rounded-[14px] bg-focus-surface flex items-center gap-1.5 text-focus-muted text-14 font-semibold hover:bg-focus-raised hover:text-focus-text transition-colors duration-sm"
              >
                <Users className="w-4 h-4" />
                Kids
              </button>
              <button
                type="button"
                aria-label={`Alerts${alertCount > 0 ? ` (${alertCount})` : ''}`}
                onClick={() => setShowAlerts(true)}
                className="relative w-11 h-11 rounded-[14px] bg-focus-surface flex items-center justify-center text-focus-muted hover:bg-focus-raised hover:text-focus-text transition-colors duration-sm"
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-focus-alert text-12 font-bold text-focus-bg leading-none">
                    {alertCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label="Settings"
                onClick={() => navigate("/settings")}
                className="w-11 h-11 rounded-[14px] bg-focus-surface flex items-center justify-center text-focus-muted hover:bg-focus-raised hover:text-focus-text transition-colors duration-sm"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Children panel — surface card, child rows separated by a rule. */}
          <section className="bg-focus-surface rounded-[24px] p-sp-2 flex flex-col gap-sp-1">
            {children.map((child, idx) => (
              <div key={child.id}>
                {idx > 0 && <div className="h-px bg-focus-raised mx-sp-3 mb-sp-1" />}
                <ChildRow
                  child={child}
                  now={childNowNext[child.id]?.now}
                  next={childNowNext[child.id]?.next}
                  pending={tasksPending}
                  onOpen={() => navigate(`/child-dashboard/${child.id}`)}
                />
              </div>
            ))}
          </section>
        </div>

        {/* Upcoming events header */}
        <h2 className="text-12 font-semibold uppercase tracking-wide text-focus-muted px-sp-4 pt-sp-2">Upcoming Events</h2>

        {/* Events list */}
        <section className="px-sp-4 flex flex-col gap-sp-2">
          {upcomingEvents.length === 0 ? (
            <div className="rounded-[24px] bg-focus-surface p-sp-4 text-center text-focus-muted text-14">
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
    <button
      type="button"
      onClick={onOpen}
      className="w-full min-h-11 flex items-center gap-sp-3 p-sp-3 rounded-[20px] text-left hover:bg-focus-raised transition-colors duration-sm"
    >
      {/* Pet avatar */}
      <div className="shrink-0 w-14 h-[62px] rounded-[20px] bg-focus-sunken flex items-center justify-center overflow-hidden">
        <PetAvatar petType={child.petType} happiness={child.petHappiness} outfit={child.pet_outfit} size="sm" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-18 font-semibold text-focus-text leading-none truncate">{child.name}</p>
        <p className="text-12 font-medium text-focus-muted truncate">
          Now: {now || (pending ? "—" : "Nothing scheduled")}
        </p>
        <p className="text-12 font-medium text-focus-muted truncate">
          Next: {next || "—"}
        </p>
      </div>

      {/* Star chip — same gold star + count used on the child interface */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] border border-focus-lime bg-focus-lime/10">
        <Star className="w-4 h-4 text-focus-lime fill-focus-lime" strokeWidth={0} />
        <span className="text-14 font-bold text-focus-lime leading-none">{child.currentCoins}</span>
      </div>
    </button>
  );
}

function EventCard({
  time,
  title,
  subtitle,
  badges,
  isParentEvent,
  allDay,
}: {
  time: string;
  title: string;
  subtitle: string;
  badges: { name: string; color: string }[];
  isParentEvent?: boolean;
  allDay?: boolean;
}) {
  const [hourMin, ampm] = splitTime(time);
  return (
    <div className="flex items-center gap-sp-3 p-sp-4 rounded-[24px] bg-focus-surface">
      {/* Time column — stacked hour + am/pm, both 12px (Figma 174:7504) */}
      <div className="shrink-0 w-11 text-right text-focus-text font-semibold leading-tight flex flex-col">
        {allDay ? (
          <span className="text-12">All day</span>
        ) : (
          <>
            <span className="text-12">{hourMin}</span>
            <span className="text-12">{ampm}</span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px self-stretch bg-focus-raised" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-16 font-semibold text-focus-text truncate flex items-center gap-1.5">
          {/* Sky calendar icon marks a parent-only appointment */}
          {isParentEvent && <CalendarClock className="w-4 h-4 text-focus-iris shrink-0" />}
          <span className="truncate">{title}</span>
        </p>
        <p className="text-12 text-focus-muted truncate">{subtitle}</p>
      </div>

      {/* Child badges — one solid pill per child sharing this slot */}
      <div className="shrink-0 flex flex-wrap items-center justify-end gap-1">
        {badges.map(b => (
          <div key={b.name} className={`px-3 py-1.5 rounded-pill ${b.color} flex items-center`}>
            <span className="text-12 font-semibold text-focus-bg">{b.name}</span>
          </div>
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
