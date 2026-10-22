/**
 * MyToki's alarm on the child's day page: when it rings on the day shown, and a sheet to turn it on
 * or off for weekdays and weekends. The alarm is the wake-up time (utils/alarm), so changing its
 * time moves wake-up too, the way the Daily Routine editor does (breakfast keeps its distance).
 */
import { useState } from "react";
import { AlarmClock, AlarmClockOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TimeTile } from "@/components/sheet/SheetParts";
import { fmtTime } from "@/components/sheet/sheetStyles";
import { useHolidays } from "@/hooks/useHolidays";
import type { Child } from "@/hooks/useChildren";
import { alarmOn, wakeOn } from "@/utils/alarm";
import { isRestDate } from "@/utils/restDays";
import { breakfastGap, updateAllSystemTaskInstances, weekendDaysLabel, weekendTimeOf, withWeekendTime } from "@/utils/systemTasks";
import { cn } from "@/lib/utils";

interface Props {
  child: Child;
  /** The day the page shows (yyyy-MM-dd). */
  date: string;
  onUpdateChild: (id: string, updates: Partial<Child>) => Promise<unknown>;
  /** The Wake Up rows moved: the timeline reloads. */
  onChanged?: () => void;
}

const toMin = (t?: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const AlarmCard = ({ child, date, onUpdateChild, onChanged }: Props) => {
  const { holidays } = useHolidays(child.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const weekdayTime = (child.wake_time ?? "07:00").slice(0, 5);
  const weekendTime = (weekendTimeOf(child, "wake")?.time ?? weekdayTime).slice(0, 5);
  const [form, setForm] = useState({ weekdays: true, weekends: true, weekdayTime, weekendTime });
  const openSheet = () => {
    setForm({ weekdays: child.alarm_weekdays !== false, weekends: child.alarm_weekends !== false, weekdayTime, weekendTime });
    setOpen(true);
  };

  // On the day shown: its wake-up (one-day changes included), or no alarm.
  const rings = alarmOn(child, date, holidays);
  const at = wakeOn(child, date, holidays);
  const restDay = isRestDate(child, date);

  // Breakfast keeps its distance from wake-up, so it has to stay before lunch.
  const gap = breakfastGap(child) ?? 0;
  const lunchWeekday = toMin(child.lunch_time);
  const lunchWeekend = toMin(weekendTimeOf(child, "lunch")?.time ?? child.lunch_time);
  const problem = (() => {
    const wd = toMin(form.weekdayTime), we = toMin(form.weekendTime);
    if (wd != null && lunchWeekday != null && wd + gap >= lunchWeekday) return "On weekdays, wake-up has to leave time for breakfast before lunch.";
    if (we != null && lunchWeekend != null && we + gap >= lunchWeekend) return "On weekends, wake-up has to leave time for breakfast before lunch.";
    return null;
  })();

  const save = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const updates: Partial<Child> = {};
      if (form.weekdays !== (child.alarm_weekdays !== false)) updates.alarm_weekdays = form.weekdays;
      if (form.weekends !== (child.alarm_weekends !== false)) updates.alarm_weekends = form.weekends;
      const movedWeekday = form.weekdayTime !== weekdayTime;
      const breakfast = movedWeekday && child.breakfast_time
        ? toHHMM(toMin(child.breakfast_time)! + toMin(form.weekdayTime)! - toMin(weekdayTime)!)
        : undefined;
      if (movedWeekday) {
        updates.wake_time = form.weekdayTime;
        if (breakfast) updates.breakfast_time = breakfast;
      }
      if (form.weekendTime !== weekendTime || movedWeekday) {
        // Weekends keep a time of their own only when it differs from weekdays.
        const own = form.weekendTime !== form.weekdayTime ? { time: form.weekendTime, duration: child.wake_duration ?? 15 } : null;
        const next = withWeekendTime(child.wake_schedule_overrides, own);
        if (JSON.stringify(next) !== JSON.stringify(child.wake_schedule_overrides ?? {})) updates.wake_schedule_overrides = next;
      }
      if (Object.keys(updates).length) await onUpdateChild(child.id, updates);
      if (movedWeekday) {
        await updateAllSystemTaskInstances(child.id, { wake_time: form.weekdayTime, ...(breakfast ? { breakfast_time: breakfast } : {}) });
        onChanged?.();
      }
      setOpen(false);
    } catch {
      toast.error("Couldn't save the alarm. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // "Ring MyToki now": a ping. Within about half a minute (its next look at the day) MyToki plays the
  // alarm's sound over whatever it is showing, for up to 30 s; a touch or its button stops it. It is
  // not the alarm: no sleeping, no "You're up!", and wake-up doesn't move.
  const [testing, setTesting] = useState(false);
  const ringNow = async () => {
    setTesting(true);
    try {
      await onUpdateChild(child.id, { alarm_test_at: new Date().toISOString() });
      toast.success("MyToki will ring in a moment, for up to 30 seconds. A tap or its button stops it.");
    } catch {
      toast.error("Couldn't reach MyToki. Please try again.");
    } finally {
      setTesting(false);
    }
  };

  const Icon = rings ? AlarmClock : AlarmClockOff;
  const rows = [
    { key: "weekdays" as const, label: "Weekdays", days: "School days", time: "weekdayTime" as const },
    { key: "weekends" as const, label: "Weekends", days: weekendDaysLabel(child, "wake", true) || "Days off", time: "weekendTime" as const },
  ];

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="flex items-center gap-sp-3 rounded-[24px] bg-focus-surface px-4 py-3 text-left hover:bg-focus-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
      >
        <Icon className={cn("w-5 h-5 shrink-0", rings ? "text-focus-lavender" : "text-focus-muted")} strokeWidth={2} />
        <span className="flex-1 min-w-0 truncate text-[15px] leading-[20px] font-semibold text-focus-text">
          {rings ? `Alarm at ${fmtTime(at)}` : "No alarm"}
        </span>
        <span className="shrink-0 text-[13px] text-focus-muted">{restDay ? "Rest day" : "MyToki"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent variant="center" className="max-w-[360px]">
          <DialogTitle className="text-[18px] font-semibold">Alarm</DialogTitle>
          <DialogDescription className="text-[13px] text-focus-muted">
            MyToki rings at wake-up until they press the button. Its time is their wake-up time, so changing one changes the other.
          </DialogDescription>
          <div className="flex flex-col gap-sp-2 pt-sp-2">
            {rows.map(row => {
              const on = form[row.key];
              return (
                <div key={row.key} className="flex items-center gap-3 rounded-[14px] bg-focus-surface px-3.5 py-2.5">
                  <label htmlFor={`alarm-${row.key}`} className="flex-1 min-w-0 flex flex-col cursor-pointer">
                    <span className="text-14 font-semibold leading-5 text-focus-text">{row.label}</span>
                    <span className="text-12 leading-[17px] text-focus-muted truncate">{row.days}</span>
                  </label>
                  <div className={cn("w-[112px] shrink-0 flex", !on && "opacity-40")}>
                    <TimeTile
                      label="Rings at"
                      stepMinutes={1}
                      value={form[row.time]}
                      onChange={(v) => v && setForm(f => ({ ...f, [row.time]: v }))}
                    />
                  </div>
                  <Switch
                    id={`alarm-${row.key}`}
                    checked={on}
                    onCheckedChange={(v) => setForm(f => ({ ...f, [row.key]: v }))}
                    aria-label={`Alarm on ${row.label.toLowerCase()}`}
                  />
                </div>
              );
            })}
          </div>
          {problem && <p role="alert" className="text-12 leading-[17px] text-focus-coral">{problem}</p>}
          <button
            type="button"
            onClick={ringNow}
            disabled={testing}
            className="mt-sp-2 min-h-12 rounded-[14px] bg-focus-surface text-focus-text text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-focus-raised disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            <BellRing className="w-4 h-4" aria-hidden />
            Ring MyToki now
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !!problem}
            className="min-h-12 rounded-[14px] bg-focus-lime text-focus-bg text-[15px] font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            Save
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AlarmCard;
