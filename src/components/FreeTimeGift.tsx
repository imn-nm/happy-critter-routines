/**
 * "Give free time": a grown-up gives the child free time starting now. Their day makes room for it
 * on every screen and the handheld (utils/liveDay applyFreeTime). While it runs, this shows until
 * when, and Stop ends it early.
 */
import { useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useFreeTimeGrants } from "@/hooks/useFreeTimeGrants";
import { cn } from "@/lib/utils";

const CHOICES = [10, 15, 30];

/** 1125 (minutes of the day) as "6:45 PM". */
const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

interface Props {
  childId: string;
  childName: string;
}

const FreeTimeGift = ({ childId, childName }: Props) => {
  const { give, stop, active } = useFreeTimeGrants(childId);
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);

  const giveMinutes = async (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
      toast.error("Choose between 1 and 240 minutes");
      return;
    }
    setBusy(true);
    try {
      await give(minutes);
      toast.success(`${childName} has ${minutes} minutes of free time`);
      setOpen(false);
      setOther("");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't give free time. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const stopNow = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await stop(active.id);
      toast.success(`${childName}'s free time has ended`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't stop free time. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    return (
      <div className="flex items-center gap-sp-3 rounded-[24px] bg-focus-surface px-4 py-3">
        <Gift className="w-5 h-5 shrink-0 text-focus-mint" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] leading-[20px] font-semibold text-focus-text">Free time until {clock(active.end)}</p>
          <p className="text-[13px] leading-[18px] text-focus-muted">The rest of the day moves later to make room</p>
        </div>
        <button
          type="button"
          onClick={stopNow}
          disabled={busy}
          className="shrink-0 min-h-11 px-4 rounded-[14px] bg-focus-raised text-[14px] font-semibold text-focus-text hover:bg-focus-bg transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
        >
          Stop
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-sp-3 rounded-[24px] bg-focus-surface px-4 py-3 text-left hover:bg-focus-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
      >
        <Gift className="w-5 h-5 shrink-0 text-focus-mint" strokeWidth={2} />
        <span className="flex-1 text-[15px] leading-[20px] font-semibold text-focus-text">Give free time</span>
        <span className="text-[13px] text-focus-muted">Starts now</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent variant="center" className="max-w-[335px]">
          <DialogTitle className="text-[18px] font-semibold">Free time for {childName}</DialogTitle>
          <DialogDescription className="text-[13px] text-focus-muted">
            It starts now. What {childName} was doing waits until after, and the rest of the day moves later.
          </DialogDescription>
          <div className="grid grid-cols-3 gap-sp-2 pt-sp-2">
            {CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => giveMinutes(m)}
                className="min-h-12 rounded-[14px] bg-focus-lime text-focus-bg text-[15px] font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
              >
                {m} min
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-sp-2"
            onSubmit={(e) => { e.preventDefault(); giveMinutes(Number(other)); }}
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="Other"
              aria-label="Other number of minutes"
              className="flex-1 min-w-0 min-h-12 rounded-[14px] bg-focus-surface px-4 text-[15px] text-focus-text placeholder:text-focus-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
            />
            <button
              type="submit"
              disabled={busy || !other}
              className={cn(
                "min-h-12 px-5 rounded-[14px] text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                other ? "bg-focus-lime text-focus-bg" : "bg-focus-surface text-focus-muted",
              )}
            >
              Give
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FreeTimeGift;
