import { ReactNode, useState } from 'react';
import { Check } from 'lucide-react';
import CircularTimer from '@/components/CircularTimer';
import TimeReserve, { TimeReserveState } from '@/components/TimeReserve';
import { getTaskIcon } from '@/utils/taskIcon';

interface Props {
  name: string;
  icon?: string | null;
  totalSeconds: number;
  remainingSeconds: number;
  done?: boolean;
  mustFinish?: boolean;
  onDone: () => Promise<void>;
  onTimeUp: () => void;
  companion: ReactNode;
  checklist?: ReactNode;
  reserve: TimeReserveState | null;
}

export default function ChildTaskFocus(props: Props) {
  const [saving, setSaving] = useState(false);
  const finish = async () => {
    if (saving || props.done) return;
    setSaving(true);
    try { await props.onDone(); } finally { setSaving(false); }
  };
  return (
    <section className="w-full grid grid-cols-1 min-[600px]:grid-cols-[180px_minmax(0,1fr)] gap-x-8 gap-y-4 items-center py-2" aria-label="Current activity">
      <div className="flex justify-center min-[600px]:row-span-3">
        <CircularTimer totalSeconds={props.totalSeconds} remainingSeconds={Math.max(0, props.remainingSeconds)}
          sizePx={152} status="on-track" isRunning={!props.done} onComplete={props.onTimeUp} frameContent>
          {props.companion}
        </CircularTimer>
      </div>
      <div className="text-center min-[600px]:text-left">
        <div className="flex items-center justify-center min-[600px]:justify-start gap-3">
          {getTaskIcon(props.name, 'w-8 h-8 text-fog-50 shrink-0', props.icon)}
          <h2 className="text-2xl font-semibold leading-tight text-fog-50 break-words">{props.name}</h2>
        </div>
        {props.done && <p className="mt-2 text-mint-400" role="status">All done!</p>}
      </div>
      {props.checklist && <div className="w-full min-[600px]:col-start-2">{props.checklist}</div>}
      {props.mustFinish && <button type="button" onClick={finish} disabled={props.done || saving}
        className="min-[600px]:col-start-2 w-full min-h-14 rounded-full bg-mint-500 text-ink-900 text-xl font-semibold flex items-center justify-center gap-2 hover:bg-mint-400 active:scale-[0.98] transition disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-fog-50">
        <Check className="w-6 h-6" aria-hidden="true" />
        {props.done ? 'Done!' : saving ? 'Saving…' : 'I’m done'}
      </button>}
      {props.reserve && <div className="min-[600px]:col-start-2 pt-3"><TimeReserve reserve={props.reserve} /></div>}
    </section>
  );
}
