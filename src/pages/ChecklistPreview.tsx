import { useState } from "react";
import TaskChecklistView from "@/components/TaskChecklistView";
import LinearTimer from "@/components/LinearTimer";
import SlideToConfirm from "@/components/SlideToConfirm";
import StatusBadge from "@/components/StatusBadge";

const MOCK_SUBTASKS = [
  { id: "1", text: "Brush your teeth" },
  { id: "2", text: "Wash your face" },
  { id: "3", text: "Put on pajamas" },
  { id: "4", text: "Pick out tomorrow's clothes" },
  { id: "5", text: "Read for 10 minutes" },
];

const ChecklistPreview = () => {
  const [checked, setChecked] = useState<string[]>(["1", "2"]);
  const toggle = (id: string) =>
    setChecked(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

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
            Bedtime Routine
          </h2>
          <StatusBadge variant="time">12:34</StatusBadge>
        </div>

        <div className="w-full flex flex-col items-center gap-sp-3">
          <LinearTimer
            totalSeconds={1800}
            remainingSeconds={754}
            status="on-track"
            isRunning={false}
          />
          <div className="w-[96px] h-[96px] rounded-full overflow-hidden">
            <img
              src="/FoxHappy.gif"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <TaskChecklistView
            subtasks={MOCK_SUBTASKS}
            checkedIds={checked}
            onToggle={toggle}
          />
        </div>

        <div className="w-full max-w-[290px] mt-sp-2">
          <SlideToConfirm label="Mark as Done" onConfirm={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default ChecklistPreview;
