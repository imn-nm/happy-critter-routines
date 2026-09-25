import { ReactNode, useState } from 'react';
import { Check, Volume2 } from 'lucide-react';
import CircularTimer from '@/components/CircularTimer';
import TimeReserve, { TimeReserveState } from '@/components/TimeReserve';
import { getTaskIcon } from '@/utils/taskIcon';
import type { DisplayMode } from '@/utils/displayMode';

interface Props {
  name: string;
  icon?: string | null;
  totalSeconds: number;
  remainingSeconds: number;
  done?: boolean;
  /** Offer "I'm done" — any task can be finished early to free up its time. */
  showDone?: boolean;
  onDone: () => Promise<void>;
  onTimeUp: () => void;
  companion: ReactNode;
  checklist?: ReactNode;
  reserve: TimeReserveState | null;
  /** Picture: a big picture and a speaker button. Detailed: exact times and a line of explanation. */
  variant?: DisplayMode;
  /** Detailed view: "4:00 – 4:20pm · 20min". */
  timeLabel?: string;
  /** Detailed view: what this task asks of them. */
  explanation?: string;
  /** Picture view: read the task (and current step) aloud. */
  onSpeak?: () => void;
}

export default function ChildTaskFocus(props: Props) {
  const [saving, setSaving] = useState(false);
  const picture = props.variant === 'picture';
  const finish = async () => {
    if (saving || props.done) return;
    setSaving(true);
    try { await props.onDone(); } finally { setSaving(false); }
  };
  return (
    <section className="w-full grid grid-cols-1 min-[600px]:grid-cols-[180px_minmax(0,1fr)] gap-x-8 gap-y-4 items-center py-2" aria-label="Current activity">
      <div className="flex justify-center min-[600px]:row-span-3">
        <CircularTimer totalSeconds={props.totalSeconds} remainingSeconds={Math.max(0, props.remainingSeconds)}
          sizePx={picture ? 168 : 152} status="on-track" isRunning={!props.done} onComplete={props.onTimeUp} frameContent>
          {props.companion}
        </CircularTimer>
      </div>
      <div className="text-center min-[600px]:text-left">
        {picture ? (
          // Big picture first: a child who can't read yet knows it by the icon.
          <div className="flex items-center justify-center min-[600px]:justify-start gap-3">
            <span className="shrink-0 w-16 h-16 rounded-[20px] bg-fog-50/10 border border-fog-50/15 flex items-center justify-center">
              {getTaskIcon(props.name, 'w-10 h-10 text-fog-50', props.icon)}
            </span>
            <h2 className="text-3xl font-semibold leading-tight text-fog-50 break-words">{props.name}</h2>
            {props.onSpeak && (
              <button
                type="button"
                onClick={props.onSpeak}
                aria-label={`Hear it: ${props.name}`}
                className="shrink-0 w-12 h-12 rounded-full bg-iris-400/20 border border-iris-400/40 text-iris-200 flex items-center justify-center hover:bg-iris-400/30 active:scale-95 transition"
              >
                <Volume2 className="w-6 h-6" aria-hidden />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center min-[600px]:justify-start gap-2.5">
              {getTaskIcon(props.name, 'w-6 h-6 text-fog-50 shrink-0', props.icon)}
              <h2 className="text-2xl font-semibold leading-tight text-fog-50 break-words">{props.name}</h2>
            </div>
            {props.timeLabel && <p className="mt-1 text-14 text-fog-200 tabular-nums">{props.timeLabel}</p>}
            {props.explanation && <p className="mt-1 text-13 text-fog-300 leading-snug max-w-sm mx-auto min-[600px]:mx-0">{props.explanation}</p>}
          </>
        )}
        {props.done && <p className="mt-2 text-mint-400" role="status">All done!</p>}
      </div>
      {props.checklist && <div className="w-full min-[600px]:col-start-2">{props.checklist}</div>}
      {props.showDone && <button type="button" onClick={finish} disabled={props.done || saving}
        aria-label={picture ? 'I’m done' : undefined}
        className={`min-[600px]:col-start-2 w-full ${picture ? 'min-h-16' : 'min-h-14'} rounded-full bg-mint-500 text-ink-900 text-xl font-semibold flex items-center justify-center gap-2 hover:bg-mint-400 active:scale-[0.98] transition disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-fog-50`}>
        {picture ? (
          // A big tick says "done" without words.
          <Check className="w-10 h-10" strokeWidth={3} aria-hidden="true" />
        ) : (
          <>
            <Check className="w-6 h-6" aria-hidden="true" />
            {props.done ? 'Done!' : saving ? 'Saving…' : 'I’m done'}
          </>
        )}
      </button>}
      {props.reserve && <div className="min-[600px]:col-start-2 pt-3"><TimeReserve reserve={props.reserve} /></div>}
    </section>
  );
}
