import { useState } from "react";
import { Settings, Star, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import CircularTimer from "@/components/CircularTimer";
import SlideToConfirm from "@/components/SlideToConfirm";
import StatusBadge from "@/components/StatusBadge";
import WormTimer from "@/components/WormTimer";
import TaskChecklistView from "@/components/TaskChecklistView";
import { Button } from "@/components/ui/button";

/**
 * Compact overdue-with-subtasks layout. Two ideas applied:
 *   1. Ring compressed to ~140px so the checklist + slide can fit without
 *      scrolling. Worried fox stays inside the ring.
 *   2. Worm hidden when there's no real fun task downstream — no
 *      "eating nothing" placeholder. Toggle the chip at the top to compare.
 */
const ChildOverdueSubtasksCompactPreview = () => {
  const [hasFunTask, setHasFunTask] = useState(true);
  const [chores, setChores] = useState([
    { id: "dishes", name: "Empty Dishwasher", done: true },
    { id: "room",   name: "Clean Room",       done: false },
  ]);

  const SUBTASKS = [
    { id: "1", text: "Read assigned pages" },
    { id: "2", text: "Answer questions 1–5" },
    { id: "3", text: "Show parent your work" },
  ];
  const [checked, setChecked] = useState<string[]>(["1"]);
  const toggleSubtask = (id: string) =>
    setChecked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const totalSecs = 30 * 60;
  const overdueS = 12 * 60;
  const wormProgress = Math.min(1, overdueS / totalSecs);
  const allDone = checked.length === SUBTASKS.length;

  const toggleChore = (id: string) =>
    setChores(prev => prev.map(c => (c.id === id ? { ...c, done: !c.done } : c)));

  const RING_PX = 140;

  return (
    <div className="min-h-screen flex flex-col items-center bg-cosmic">
      <div className="w-full max-w-[420px] px-sp-2 py-sp-5 flex flex-col gap-sp-2">
        {/* Top: Parent pill + demo toggle for the fun-task scenario */}
        <div className="flex justify-between items-center mb-sp-3">
          <button
            type="button"
            onClick={() => setHasFunTask(v => !v)}
            className="text-12 text-iris-400 underline-offset-2 hover:underline"
          >
            Demo: {hasFunTask ? "fun task scheduled" : "no fun task"} — toggle
          </button>
          <button
            type="button"
            className="tap-target flex items-center gap-1.5 h-[31px] px-[14px] rounded-pill bg-white/[0.06] border border-white/10 text-fog-50"
          >
            <Settings className="w-3 h-3" />
            <span className="text-12 font-medium">Parent</span>
          </button>
        </div>

        {/* Greeting + coin chip */}
        <div className="flex items-center justify-between mb-sp-3">
          <p className="text-20 text-fog-50 leading-none">Hi, Amira!</p>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border-2 border-iris-400/[0.32]">
            <Star className="w-4 h-4 text-[#FFD66B] fill-[#FFD66B]" strokeWidth={0} />
            <span className="text-13 font-bold text-fog-50 leading-none">1</span>
          </div>
        </div>

        {/* Active task block */}
        <div className="flex flex-col items-center gap-sp-3 mb-sp-4">
          {/* Title + Overdue badge */}
          <div className="flex flex-col items-center gap-1 py-1">
            <h2
              className="text-fog-50"
              style={{
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 24,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              Homework
            </h2>
            <StatusBadge variant="overdue">Overdue</StatusBadge>
          </div>

          {/* Compact 140px overdue ring — universal timer anchor; works whether
              or not there's a fun task downstream. */}
          <CircularTimer
            totalSeconds={totalSecs}
            remainingSeconds={0}
            status="overtime"
            sizePx={RING_PX}
            isRunning={false}
          >
            <img
              src="/FoxWorried.gif"
              alt=""
              className="w-full h-full object-cover"
            />
          </CircularTimer>

          {/* Worm timer — only shown when an actual fun task is queued.
              Without one we drop the worm rather than show a placeholder. */}
          {hasFunTask && (
            <div className="w-full px-sp-2 flex flex-col items-center gap-2">
              <WormTimer progress={wormProgress} />
              <p className="text-12 text-fog-200">
                <span className="font-medium text-fog-50">Game Time</span> — 18m left
              </p>
            </div>
          )}

          {/* Subtask checklist */}
          <div className="w-full px-sp-4">
            <TaskChecklistView
              subtasks={SUBTASKS}
              checkedIds={checked}
              onToggle={toggleSubtask}
            />
          </div>

          {/* Mark as Done slide */}
          <div className="w-full px-sp-4 mt-sp-1">
            <SlideToConfirm
              label="Mark as Done"
              onConfirm={() => {}}
              disabled={!allDone}
            />
          </div>

          {/* Chore tiles */}
          <div className="w-full px-sp-4 flex flex-col gap-sp-1">
            <p className="text-14 text-iris-400 leading-none">Chores</p>
            <div className="w-full flex items-stretch gap-sp-1">
              {chores.map(chore => (
                <button
                  key={chore.id}
                  type="button"
                  onClick={() => toggleChore(chore.id)}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center justify-center gap-sp-1 px-sp-4 py-sp-2 rounded-[20px] border transition-colors",
                    chore.done
                      ? "bg-mint-500/20 border-mint-500"
                      : "bg-[#271447] border-transparent hover:bg-[#2f1856]",
                  )}
                >
                  {chore.done ? (
                    <Check className="w-4 h-4 text-mint-500" strokeWidth={3} />
                  ) : (
                    <Sparkles className="w-4 h-4 text-fog-50" strokeWidth={2} />
                  )}
                  <span className="w-full text-12 text-center leading-tight text-fog-50">
                    {chore.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Next task row */}
          <div className="w-full px-sp-4 flex items-end justify-between gap-sp-3 pt-sp-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-14 text-iris-400">Next</span>
              <span className="text-16 text-fog-50 truncate">Soccer Practice</span>
            </div>
            <StatusBadge variant="time">4:00pm</StatusBadge>
          </div>

          {/* Today's Schedule */}
          <div className="w-full px-sp-4">
            <Button variant="secondary" size="md" className="w-full">
              Today's Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildOverdueSubtasksCompactPreview;
