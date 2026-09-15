import { useEffect, useRef, useState } from 'react';
import WormTimer from '@/components/WormTimer';

export interface TimeReserveState {
  id: string;
  name: string;
  icon?: string | null;
  totalSeconds: number;
  remainingSeconds: number;
}

/** One fixed-size window onto the reserve. Only the affected activity is shown. */
export default function TimeReserve({ reserve }: { reserve: TimeReserveState }) {
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
      <p className="text-12 text-fog-200">
        <span className="font-medium text-fog-50">{reserve.name}</span> — {minutes}m left
      </p>
      <p className="min-h-5 text-12 text-fog-300 text-center" role="status" aria-live="polite">
        {notice || (remaining === 0 ? 'All used for today' : '')}
      </p>
    </section>
  );
}
