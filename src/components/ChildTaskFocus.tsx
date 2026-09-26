import { ReactNode } from 'react';
import { AlarmClock, Clock, Volume2 } from 'lucide-react';
import CircularTimer from '@/components/CircularTimer';
import SlideToConfirm from '@/components/SlideToConfirm';
import StatusBadge from '@/components/StatusBadge';
import TimeReserve, { TimeReserveState } from '@/components/TimeReserve';
import { getTaskIcon } from '@/utils/taskIcon';
import type { DisplayMode } from '@/utils/displayMode';

interface Props {
  name: string;
  icon?: string | null;
  totalSeconds: number;
  remainingSeconds: number;
  done?: boolean;
  /** Offer "Mark as Done" — any task can be finished early to free up its time. */
  showDone?: boolean;
  onDone: () => Promise<void>;
  onTimeUp: () => void;
  companion: ReactNode;
  checklist?: ReactNode;
  reserve: TimeReserveState | null;
  /** A must-do task whose window has passed and is still on screen. */
  overdue?: boolean;
  /** Picture: a big picture and a speaker button. Detailed: exact times and a line of explanation. */
  variant?: DisplayMode;
  /** "4:00pm – 4:20pm · 20min" (picture view: just the times). */
  timeLabel?: string;
  /** Detailed view: what this task asks of them. */
  explanation?: string;
  /** Picture view: read the task (and current step) aloud. */
  onSpeak?: () => void;
}

/**
 * The child's current activity — Figma "Child / Focus — redesigned" (339:125):
 * a focus-surface card (radius 28) with the task title and a status badge,
 * the pet inside a lavender timer ring, the worm when time is being eaten,
 * and the lime slide-to-confirm "Mark as Done".
 */
export default function ChildTaskFocus(props: Props) {
  const picture = props.variant === 'picture';
  const finish = async () => {
    if (props.done) return;
    await props.onDone();
  };
  const minutesLeft = Math.max(0, Math.ceil(props.remainingSeconds / 60));

  const badge = props.done ? (
    <StatusBadge variant="complete">Done!</StatusBadge>
  ) : props.overdue ? (
    <StatusBadge variant="overdue">
      {picture ? <><AlarmClock className="w-4 h-4" aria-hidden /><span className="sr-only">Overdue</span></> : 'Overdue'}
    </StatusBadge>
  ) : props.remainingSeconds > 0 ? (
    <StatusBadge variant="time">
      <span className="tabular-nums">{picture ? `${minutesLeft}m` : `${minutesLeft} min left`}</span>
    </StatusBadge>
  ) : null;

  return (
    <section className="w-full flex flex-col items-center gap-sp-3 p-4 rounded-[28px] bg-focus-surface" aria-label="Current activity">
      <div className="w-full flex flex-col gap-1">
        <div className="w-full min-h-9 flex items-center justify-between gap-sp-2">
          {picture ? (
            // Big picture first: a child who can't read yet knows it by the icon.
            <div className="flex items-center gap-sp-2 min-w-0">
              <span className="shrink-0 w-14 h-14 rounded-[18px] bg-focus-raised flex items-center justify-center">
                {getTaskIcon(props.name, 'w-9 h-9 text-focus-text', props.icon)}
              </span>
              <h2 className="text-[26px] font-semibold leading-tight text-focus-text break-words min-w-0">{props.name}</h2>
            </div>
          ) : (
            <h2 className="text-[26px] font-semibold leading-tight text-focus-text break-words min-w-0">{props.name}</h2>
          )}
          <div className="shrink-0 flex items-center gap-sp-2">
            {badge}
            {picture && props.onSpeak && (
              <button
                type="button"
                onClick={props.onSpeak}
                aria-label={`Hear it: ${props.name}`}
                className="shrink-0 w-11 h-11 rounded-full bg-focus-lavender/20 text-focus-lavender flex items-center justify-center hover:bg-focus-lavender/30 active:scale-95 transition"
              >
                <Volume2 className="w-6 h-6" aria-hidden />
              </button>
            )}
          </div>
        </div>
        {/* The clock times too: seeing them beside the picture is how the
            clock starts to mean something. */}
        {props.timeLabel && (
          <p className={picture
            ? 'inline-flex items-center gap-1.5 text-18 font-medium text-focus-text tabular-nums'
            : 'text-14 text-focus-muted tabular-nums'}>
            {picture && <Clock className="w-5 h-5 text-focus-lavender" aria-hidden />}
            {props.timeLabel}
          </p>
        )}
        {!picture && props.explanation && <p className="text-13 text-focus-muted/80 leading-snug">{props.explanation}</p>}
      </div>

      <div className="w-full flex items-center justify-center py-1.5">
        <CircularTimer totalSeconds={props.totalSeconds} remainingSeconds={Math.max(0, props.remainingSeconds)}
          sizePx={220} status="on-track" isRunning={!props.done} onComplete={props.onTimeUp} frameContent>
          {props.companion}
        </CircularTimer>
      </div>

      {props.reserve && <TimeReserve reserve={props.reserve} picture={picture} />}
      {props.checklist && <div className="w-full">{props.checklist}</div>}
      {props.done && <p className={picture ? 'sr-only' : 'text-14 text-focus-mint'} role="status">All done!</p>}
      {props.showDone && (
        <SlideToConfirm
          label="Mark as Done"
          iconOnly={picture}
          disabled={props.done}
          onConfirm={finish}
        />
      )}
    </section>
  );
}
