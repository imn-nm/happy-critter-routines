import { useState } from 'react';
import ChildTaskFocus from '@/components/ChildTaskFocus';
import CritterPet from '@/components/critters/CritterPet';
import { calculateTimeReserve } from '@/utils/timeReserve';

const tasks = [
  { id: 'lunch', name: 'Finish lunch', scheduled_time: '12:00', duration: 20, is_important: true },
  { id: 'school', name: 'Afternoon activities', scheduled_time: '12:30', duration: 360 },
  { id: 'story', name: 'Storytime', scheduled_time: '18:30', duration: 20, is_fun_time: true },
  { id: 'bed', name: 'Bedtime', scheduled_time: '18:50', duration: 10 },
];

export default function TimeReservePreview() {
  const [minutes, setMinutes] = useState(17);
  const [done, setDone] = useState(false);
  const reserve = calculateTimeReserve(tasks, [], new Date(2026, 8, 13, 12, minutes)).reserve;
  return <main className="min-h-dvh px-6 py-5 text-fog-50">
    <div className="max-w-[660px] mx-auto">
      <p className="text-lg mb-2">Hi, Alex!</p>
      <ChildTaskFocus name="Finish lunch" totalSeconds={1200} remainingSeconds={(20 - minutes) * 60}
        mustFinish done={done} onDone={async () => setDone(true)} onTimeUp={() => {}}
        reserve={reserve} companion={<CritterPet petType="rabbit" mood={done ? 'celebrate' : 'happy'}
          timerFrame size={112} className="w-full h-full" />} />
      <details className="mt-5 text-sm text-fog-200">
        <summary className="cursor-pointer py-3">Try the design</summary>
        <div className="flex flex-wrap gap-2 mt-2">
          {[[17, 'On time'], [25, 'Using free time'], [30, 'Free time finished'], [35, 'Using storytime'], [50, 'All used']].map(([value, label]) =>
            <button key={value} className="rounded-lg bg-white/10 p-3" onClick={() => { setMinutes(Number(value)); setDone(false); }}>{label}</button>)}
        </div>
      </details>
    </div>
  </main>;
}
