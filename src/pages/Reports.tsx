import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDays, format, subDays } from "date-fns";
import { ArrowLeft, Star, Gift, ListChecks, Check, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/hooks/useChildren";
import { isApprovedStatus } from "@/hooks/useRewards";
import { occursOnDate, windowEnd } from "@/utils/missedImportant";
import { getPSTDateString, getPSTTimeString } from "@/utils/pstDate";
import { formatTime12 } from "@/utils/formatTime";
import { cn } from "@/lib/utils";
import LoadingScreen from "@/components/LoadingScreen";

const DAYS = 14;

interface TaskRow {
  id: string;
  child_id: string;
  name: string;
  type: string;
  scheduled_time: string | null;
  duration: number | null;
  is_active: boolean;
  is_important: boolean;
  is_recurring: boolean;
  recurring_days: string[] | null;
  task_date: string | null;
  excluded_dates: string[] | null;
  created_at: string;
  date_overrides: Record<string, { scheduled_time?: string; duration?: number }> | null;
  schedule_overrides: Record<string, { scheduled_time?: string; duration?: number }> | null;
}

interface CompletionRow {
  id: string;
  task_id: string;
  date: string;
  coins_earned: number;
  completed_at: string;
}

interface PurchaseRow {
  id: string;
  reward_id: string;
  coins_spent: number;
  purchased_at: string;
  status: string;
}

type DayStatus = "done" | "missed" | "pending" | "none";

/**
 * Parent report for one child: the last two weeks of must-finish tasks,
 * chores, and stars, straight from task_completions and reward_purchases.
 */
const Reports = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { children, loading: childrenLoading } = useChildren();
  const child = children.find(c => c.id === childId);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [rewardNames, setRewardNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const today = getPSTDateString();
  const start = format(subDays(new Date(today + "T00:00:00"), DAYS - 1), "yyyy-MM-dd");

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [t, c, p, r] = await Promise.all([
        supabase.from("tasks").select("*").eq("child_id", childId),
        supabase.from("task_completions").select("id, task_id, date, coins_earned, completed_at").eq("child_id", childId).gte("date", start).order("completed_at", { ascending: false }),
        supabase.from("reward_purchases").select("id, reward_id, coins_spent, purchased_at, status").eq("child_id", childId).gte("purchased_at", start).order("purchased_at", { ascending: false }),
        supabase.from("rewards").select("id, name").eq("child_id", childId),
      ]);
      if (cancelled) return;
      setTasks((t.data ?? []) as unknown as TaskRow[]);
      setCompletions((c.data ?? []) as CompletionRow[]);
      setPurchases((p.data ?? []) as PurchaseRow[]);
      setRewardNames(new Map(((r.data ?? []) as { id: string; name: string }[]).map(x => [x.id, x.name])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, start]);

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // Per-day view of must-finish tasks.
  const days = useMemo(() => {
    const nowStr = getPSTTimeString();
    const out: { date: string; label: string; items: { name: string; status: DayStatus }[] }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = subDays(new Date(today + "T00:00:00"), i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayName = format(d, "EEEE").toLowerCase();
      const items = tasks
        .filter(t => t.is_important && t.type !== "floating" && occursOnDate(t, dateStr, dayName))
        .map(t => {
          const done = completions.some(c => c.task_id === t.id && c.date === dateStr);
          if (done) return { name: t.name, status: "done" as DayStatus };
          if (dateStr < today) return { name: t.name, status: "missed" as DayStatus };
          const end = windowEnd(t, dateStr, dayName);
          return { name: t.name, status: (end && nowStr >= end ? "missed" : "pending") as DayStatus };
        });
      out.push({ date: dateStr, label: format(d, "EEE d"), items });
    }
    return out;
  }, [tasks, completions, today]);

  const importantDone = days.flatMap(d => d.items).filter(i => i.status === "done").length;
  const importantMissed = days.flatMap(d => d.items).filter(i => i.status === "missed").length;
  const choresDone = completions.filter(c => taskById.get(c.task_id)?.type === "floating").length;
  const starsEarned = completions.reduce((s, c) => s + (c.coins_earned || 0), 0);
  const approved = purchases.filter(p => isApprovedStatus(p.status));
  const starsSpent = approved.reduce((s, p) => s + p.coins_spent, 0);

  // Ledger: completions that paid stars, and approved rewards.
  const ledger = useMemo(() => {
    const rows = [
      ...completions
        .filter(c => (c.coins_earned || 0) > 0)
        .map(c => ({ id: c.id, at: c.completed_at, label: taskById.get(c.task_id)?.name ?? "Task", delta: c.coins_earned })),
      ...approved.map(p => ({ id: p.id, at: p.purchased_at, label: rewardNames.get(p.reward_id) ?? "Reward", delta: -p.coins_spent })),
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  }, [completions, approved, taskById, rewardNames]);

  if (childrenLoading || loading) {
    return <LoadingScreen />;
  }
  if (!child) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-sp-3 text-fog-200">
        <p>Child not found</p>
        <button type="button" onClick={() => navigate("/parent")} className="text-iris-400 underline">Back</button>
      </div>
    );
  }

  const Tile = ({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) => (
    <div className="flex flex-col gap-1 p-sp-3 rounded-[20px] bg-[rgba(8,1,26,0.4)]">
      <div className="flex items-center gap-1.5 text-fog-300">{icon}<span className="text-12">{label}</span></div>
      <span className="text-24 font-bold text-fog-50 tabular-nums leading-none">{value}</span>
    </div>
  );

  return (
    <div className="min-h-dvh px-sp-2 py-sp-5">
      <div className="max-w-[420px] mx-auto flex flex-col gap-sp-4">
        <div className="flex items-center gap-sp-2">
          <button
            type="button"
            onClick={() => navigate(`/child-dashboard/${child.id}`)}
            aria-label="Back"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5 text-fog-50" />
          </button>
          <div>
            <h1 className="text-20 text-fog-50 leading-tight">{child.name}'s last two weeks</h1>
            <p className="text-12 text-fog-300">{format(new Date(start + "T00:00:00"), "MMM d")} to {format(new Date(today + "T00:00:00"), "MMM d")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sp-2">
          <Tile icon={<Star className="w-3.5 h-3.5 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />} value={starsEarned} label="Stars earned" />
          <Tile icon={<Gift className="w-3.5 h-3.5" />} value={starsSpent} label="Stars spent" />
          <Tile icon={<Check className="w-3.5 h-3.5 text-mint-400" />} value={`${importantDone} / ${importantDone + importantMissed}`} label="Must-finish done" />
          <Tile icon={<ListChecks className="w-3.5 h-3.5" />} value={choresDone} label="Chores done" />
        </div>

        {/* Day strip */}
        <section className="rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
          <h2 className="text-14 font-medium text-iris-400">Must-finish tasks by day</h2>
          <div className="flex flex-col gap-sp-2">
            {days.filter(d => d.items.length > 0).length === 0 && (
              <p className="text-13 text-fog-300">No must-finish tasks in this period.</p>
            )}
            {days.filter(d => d.items.length > 0).map(d => (
              <div key={d.date} className="flex items-start gap-sp-3">
                <span className={cn("w-14 shrink-0 text-12 tabular-nums whitespace-nowrap", d.date === today ? "text-fog-50 font-medium" : "text-fog-300")}>{d.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {d.items.map((it, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 h-6 rounded-pill text-12",
                        it.status === "done" && "bg-mint-500/20 text-mint-300",
                        it.status === "missed" && "bg-amber-400/15 text-amber-300",
                        it.status === "pending" && "bg-white/5 text-fog-300",
                      )}
                    >
                      {it.status === "done" ? <Check className="w-3 h-3" strokeWidth={3} /> : it.status === "missed" ? <Minus className="w-3 h-3" /> : null}
                      {it.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Star ledger */}
        <section className="rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
          <div className="flex items-center justify-between">
            <h2 className="text-14 font-medium text-iris-400">Star ledger</h2>
            <span className="text-12 text-fog-300">Balance now: {child.currentCoins}</span>
          </div>
          {ledger.length === 0 ? (
            <p className="text-13 text-fog-300">No stars earned or spent yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {ledger.map(row => (
                <li key={row.id} className="flex items-center gap-sp-2">
                  <span className="text-12 text-fog-300 w-[92px] shrink-0 tabular-nums">
                    {format(new Date(row.at), "MMM d")} · {formatTime12(format(new Date(row.at), "HH:mm"))}
                  </span>
                  <span className="flex-1 min-w-0 text-14 text-fog-50 truncate">{row.label}</span>
                  <span className={cn("text-14 font-semibold tabular-nums", row.delta > 0 ? "text-[#FFD66B]" : "text-fog-300")}>
                    {row.delta > 0 ? "+" : ""}{row.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default Reports;
