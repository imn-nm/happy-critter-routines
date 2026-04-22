import { useEffect, useState } from "react";

interface TimeSqueezeProps {
  overdueTaskName: string;
  overdueSeconds: number; // how many seconds overdue (positive)
  funTimeTaskName: string;
  funTimeTotalSeconds: number; // original full duration of the fun time task
  funTimeRemainingSeconds: number; // how much is left (can go to 0)
}

const TimeSqueeze = ({
  overdueTaskName,
  overdueSeconds,
  funTimeTaskName,
  funTimeTotalSeconds,
  funTimeRemainingSeconds,
}: TimeSqueezeProps) => {
  const [, setTick] = useState(0);

  // Re-render every second so the bars animate live
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const overdueMin = Math.floor(overdueSeconds / 60);
  const overdueSec = overdueSeconds % 60;
  const overdueLabel = overdueMin > 0
    ? `+${overdueMin}m`
    : `+${overdueSec}s`;

  const funRemainingMin = Math.floor(Math.max(0, funTimeRemainingSeconds) / 60);
  const funRemainingLabel = funTimeRemainingSeconds <= 0 ? "Gone" : `${funRemainingMin}m`;

  // Overdue bar grows from 0 → full (capped at funTimeTotalSeconds for visual scale)
  const overdueBarPct = Math.min(
    100,
    funTimeTotalSeconds > 0 ? (overdueSeconds / funTimeTotalSeconds) * 100 : 0
  );

  // Fun time bar shrinks. Never go below a visual minimum (~4%) until truly 0.
  const rawFunPct = funTimeTotalSeconds > 0
    ? (funTimeRemainingSeconds / funTimeTotalSeconds) * 100
    : 0;
  const funBarPct = funTimeRemainingSeconds <= 0
    ? 0
    : Math.max(4, rawFunPct);

  const isGone = funTimeRemainingSeconds <= 0;

  return (
    <div className="mt-5 space-y-4">
      <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
        what's at stake
      </p>

      {/* Overdue bar — red, grows rightward */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center px-0.5">
          <span className="text-xs text-red-400 font-medium truncate max-w-[65%]">{overdueTaskName}</span>
          <span className="text-xs text-red-400 font-bold">{overdueLabel}</span>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 ease-linear"
            style={{ width: `${overdueBarPct}%` }}
          />
        </div>
      </div>

      {/* Fun time bar — purple, shrinks leftward */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center px-0.5">
          <span className={`text-xs font-medium truncate max-w-[65%] ${isGone ? 'text-muted-foreground' : 'text-purple-400'}`}>
            {funTimeTaskName}
          </span>
          <span className={`text-xs font-bold ${isGone ? 'text-muted-foreground' : 'text-purple-400'}`}>
            {funRemainingLabel}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          {isGone ? (
            <div className="h-full w-full rounded-full flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground font-semibold tracking-wider">GONE</span>
            </div>
          ) : (
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-1000 ease-linear"
              style={{ width: `${funBarPct}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeSqueeze;
