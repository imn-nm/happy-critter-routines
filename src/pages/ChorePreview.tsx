import { useState } from "react";
import CircularTimer from "@/components/CircularTimer";
import SlideToConfirm from "@/components/SlideToConfirm";
import StatusBadge from "@/components/StatusBadge";

/**
 * Preview of how chores appear on the child view: a compact secondary
 * SlideToConfirm row below the main task slide, only during the chore's
 * time window. The main task takes visual precedence; chore rows sit
 * beneath at half the thumb size, 14px label, slight opacity reduction.
 */
const ChorePreview = () => {
  const [doneChores, setDoneChores] = useState<string[]>([]);

  const chores = [
    { id: "tidy", name: "Tidy room" },
    { id: "feed", name: "Feed the cat" },
  ];

  // Completed chores stay visible — they just render as struck-through.

  return (
    <div className="min-h-screen flex flex-col items-center bg-cosmic">
      <div className="w-full max-w-[420px] px-sp-4 pt-sp-6 pb-sp-5 flex flex-col items-center gap-sp-4">
        <div className="flex flex-col items-center gap-1 py-2">
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
          <StatusBadge variant="time">25:30</StatusBadge>
        </div>

        <CircularTimer
          totalSeconds={1800}
          remainingSeconds={1530}
          status="on-track"
          sizePx={293}
          isRunning={false}
        >
          <img
            src="/FoxHappy.gif"
            alt=""
            className="w-full h-full object-cover"
          />
        </CircularTimer>

        {/* Primary slide-to-confirm — Mark as Done */}
        <div className="w-full max-w-[290px] mt-sp-2">
          <SlideToConfirm label="Mark as Done" onConfirm={() => {}} />
        </div>

        {/* Chore line items — simple rows matching the parent dashboard task
            cards. Completed chores stay visible with a filled mint circle and
            strikethrough text. */}
        {chores.length > 0 && (
          <div className="w-full flex flex-col gap-sp-2 mt-2">
            {chores.map(chore => {
              const done = doneChores.includes(chore.id);
              const coinsLabel = chore.id === "tidy" ? "5 stars" : "3 stars";
              return (
                <button
                  key={chore.id}
                  type="button"
                  disabled={done}
                  onClick={() => setDoneChores(prev => [...prev, chore.id])}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-[28px] border transition-colors text-left ${
                    done
                      ? "bg-mint-500/[0.06] border-mint-500/30 cursor-default"
                      : "bg-iris-400/10 hover:bg-iris-400/[0.14] border-iris-400/20"
                  }`}
                >
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center transition-colors ${
                      done
                        ? "bg-mint-500 border-2 border-mint-500"
                        : "border-2 border-iris-400/50"
                    }`}
                  >
                    {done && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        className="w-4 h-4 text-ink-900"
                      >
                        <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`flex-1 min-w-0 text-16 truncate ${
                      done ? "text-fog-300 line-through" : "text-fog-50"
                    }`}
                  >
                    {chore.name}
                  </span>
                  <span className={`shrink-0 text-14 ${done ? "text-fog-400" : "text-[#9EBEFF]"}`}>
                    {coinsLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Next row */}
        <div className="w-full flex items-end justify-between gap-sp-3 pt-sp-2">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-14 text-iris-400">Next</span>
            <span className="text-16 text-fog-50 truncate">Soccer Practice</span>
          </div>
          <StatusBadge variant="time">4:00pm</StatusBadge>
        </div>
      </div>
    </div>
  );
};

export default ChorePreview;
