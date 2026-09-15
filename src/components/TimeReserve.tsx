import { useEffect, useRef, useState } from 'react';
import { getTaskIcon } from '@/utils/taskIcon';
import { Leaf } from 'lucide-react';

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
  const used = 1 - fraction;
  const minutes = Math.ceil(remaining / 60);
  return (
    <section className="w-full text-fog-50" aria-label="Time left for later">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {reserve.id === 'free-time' ? <Leaf className="w-6 h-6 shrink-0 text-mint-400" aria-hidden="true" /> : getTaskIcon(reserve.name, 'w-6 h-6 shrink-0 text-mint-400', reserve.icon)}
          <h3 className="text-lg font-medium leading-tight break-words">{reserve.name} left</h3>
        </div>
        <span className="text-lg font-semibold tabular-nums whitespace-nowrap">{minutes} min</span>
      </div>
      <div className="relative h-7 rounded-full border border-mint-500/50 bg-white/5"
        role="meter" aria-label={`${reserve.name} remaining`} aria-valuemin={0}
        aria-valuemax={reserve.totalSeconds} aria-valuenow={remaining}
        aria-valuetext={`${minutes} minutes left`}>
        <div className="absolute inset-0 rounded-full overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-mint-500 origin-right transition-transform duration-700 motion-reduce:transition-none"
            style={{ transform: `scaleX(${fraction})` }} />
        </div>
        {/* The worm sits exactly on the lost/remaining boundary, from the first minute. */}
        {used > 0 && fraction > 0 && (
          <span aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-xl bg-amber-400 border-2 border-ink-900 transition-[left] duration-700 motion-reduce:transition-none"
            style={{ left: `clamp(16px, ${used * 100}%, calc(100% - 16px))` }}>
            <span className="absolute top-1.5 right-1.5 w-1 h-1 bg-ink-900 rounded-full" />
            <span className="absolute bottom-1.5 right-0 w-2 h-1 bg-ink-900 rounded-l-full" />
          </span>
        )}
      </div>
      <p className="min-h-6 mt-2 text-sm text-fog-200 text-center" role="status" aria-live="polite">
        {notice || (remaining === 0 ? 'All used for today' : '')}
      </p>
    </section>
  );
}
