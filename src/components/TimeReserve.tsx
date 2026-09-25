import { useEffect, useRef, useState } from 'react';
import WormTimer from '@/components/WormTimer';
import { getTaskIcon } from '@/utils/taskIcon';

export interface TimeReserveState {
  id: string;
  name: string;
  icon?: string | null;
  totalSeconds: number;
  remainingSeconds: number;
}

/**
 * One fixed-size window onto the reserve. Only the affected activity is shown.
 * Picture view: the activity's picture and the minutes, no sentence.
 */
export default function TimeReserve({ reserve, picture = false }: { reserve: TimeReserveState; picture?: boolean }) {
  const { id, name } = reserve;
  const previous = useRef({ id, name });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (previous.current.id !== id) {
      setNotice(`${previous.current.name} is finished`);
      const timer = window.setTimeout(() => setNotice(''), 4000);
      previous.current = { id, name };
      return () => window.clearTimeout(timer);
    }
    previous.current = { id, name };
  }, [id, name]);
  const remaining = Math.max(0, reserve.remainingSeconds);
  const fraction = reserve.totalSeconds > 0 ? Math.min(1, remaining / reserve.totalSeconds) : 0;
  const minutes = Math.ceil(remaining / 60);
  // The retro pixel worm eats into the time as it's used up.
  return (
    <section className="w-full flex flex-col items-center gap-1" aria-label="Time left for later">
      <WormTimer progress={1 - fraction} />
      {picture ? (
        <p className="flex items-center gap-2 text-16 font-semibold text-fog-50 tabular-nums" aria-label={`${reserve.name}: ${minutes} minutes left`}>
          {getTaskIcon(reserve.name, 'w-6 h-6 text-fog-50', reserve.icon)}
          <span aria-hidden>{minutes}m</span>
        </p>
      ) : (
        <p className="text-12 text-fog-200">
          <span className="font-medium text-fog-50">{reserve.name}</span> — {minutes}m left
        </p>
      )}
      <p className={picture ? "sr-only" : "min-h-5 text-12 text-fog-300 text-center"} role="status" aria-live="polite">
        {notice || (remaining === 0 ? 'All used for today' : '')}
      </p>
    </section>
  );
}
