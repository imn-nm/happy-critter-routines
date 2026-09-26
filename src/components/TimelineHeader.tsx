import { useState, useEffect } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, PartyPopper, StickyNote } from "lucide-react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { getPSTDate } from "@/utils/pstDate";
import { useHolidays } from "@/hooks/useHolidays";
import { useDayNotes } from "@/hooks/useDayNotes";
import { useParentEvents } from "@/hooks/useParentEvents";
import { formatTime12 } from "@/utils/formatTime";
import { Child } from "@/hooks/useChildren";
import { cn } from "@/lib/utils";

interface TimelineHeaderProps {
  child: Child;
  selectedDay: Date;
  onSelectedDayChange: (day: Date) => void;
}

const navButton =
  "shrink-0 h-11 w-11 inline-flex items-center justify-center rounded-[16px] bg-focus-bg text-focus-iris hover:bg-focus-raised transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender";

/**
 * Week navigation + day strip for the Day tab (Figma 355:390 / 357:379).
 * Sits inside the schedule card on ChildDashboard, under the Day/Month
 * switch. "Today" appears only while another week is on screen.
 */
export default function TimelineHeader({
  child,
  selectedDay,
  onSelectedDayChange,
}: TimelineHeaderProps) {
  const [currentWeek, setCurrentWeek] = useState(selectedDay);
  const { isHoliday } = useHolidays(child.id);
  const { getNoteForDate } = useDayNotes(child.id);
  const { getEventsForDate } = useParentEvents(child.id);

  // Keep the visible week aligned to whatever day is selected externally.
  const selectedDayKey = format(selectedDay, "yyyy-MM-dd");
  useEffect(() => {
    setCurrentWeek(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayKey]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const selectedDayHoliday = isHoliday(selectedDayKey);
  const selectedDayNote = getNoteForDate(selectedDayKey);
  const selectedDayEvents = getEventsForDate(selectedDayKey);

  const formatWeekRange = (start: Date) => {
    const end = addDays(start, 6);
    const startMonth = format(start, "MMM");
    const endMonth = format(end, "MMM");
    if (startMonth === endMonth) {
      return `${startMonth} ${format(start, "d")}–${format(end, "d")}`;
    }
    return `${startMonth} ${format(start, "d")} – ${endMonth} ${format(end, "d")}`;
  };

  const goToPreviousWeek = () => setCurrentWeek(prev => addDays(prev, -7));
  const goToNextWeek = () => setCurrentWeek(prev => addDays(prev, 7));

  const pstToday = getPSTDate();
  // Figma 02a: the pill shows only when the week on screen isn't this week.
  const isThisWeek = isSameDay(weekStart, startOfWeek(pstToday, { weekStartsOn: 0 }));

  return (
    <div className="flex flex-col gap-sp-4">
      {/* Week navigation */}
      <div className="flex items-center gap-sp-2">
        <div className="flex flex-1 min-w-0 items-center gap-sp-2">
          <button type="button" onClick={goToPreviousWeek} aria-label="Previous week" className={navButton}>
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <span className="flex-1 min-w-0 truncate text-center text-[15px] leading-[21px] font-semibold text-focus-text">
            {formatWeekRange(weekStart)}
          </span>
          <button type="button" onClick={goToNextWeek} aria-label="Next week" className={navButton}>
            <ChevronRight className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        {!isThisWeek && (
          <button
            type="button"
            onClick={() => {
              onSelectedDayChange(pstToday);
              setCurrentWeek(pstToday);
            }}
            className="shrink-0 h-11 px-sp-4 rounded-[14px] border border-focus-lavender text-[14px] font-semibold text-focus-lavender hover:bg-focus-lavender/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender"
          >
            Today
          </button>
        )}
      </div>

      {/* Day strip */}
      <div className="flex items-stretch" role="group" aria-label="Days of the week">
        {weekDays.map((day, index) => {
          const isSelected = isSameDay(day, selectedDay);
          const isToday = isSameDay(day, pstToday);
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectedDayChange(day)}
              aria-pressed={isSelected}
              aria-label={format(day, "EEEE, MMMM d")}
              className={cn(
                "flex-1 min-w-0 h-[67px] flex flex-col items-center justify-between py-2 rounded-[14px] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-lavender",
                isSelected
                  ? "bg-focus-lavender text-focus-bg"
                  : cn("hover:bg-focus-raised/60", isToday && "ring-[1.5px] ring-inset ring-focus-lavender"),
              )}
            >
              <span className={cn("text-[12px] leading-4 font-medium", !isSelected && "text-focus-muted")}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][index]}
              </span>
              <span
                className={cn(
                  "text-[17px] leading-[22px] tabular-nums",
                  isSelected ? "font-semibold" : "font-normal text-focus-text",
                )}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      {/* What the parent marked on the selected day — kept small; edit
          them from the Month tab's day drawer. */}
      {(selectedDayHoliday || selectedDayNote || selectedDayEvents.length > 0) && (
        <div className="flex flex-wrap justify-center gap-sp-2">
          {selectedDayHoliday && (
            <span className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-focus-lime/15 text-[12px] font-semibold text-focus-lime">
              <PartyPopper className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {selectedDayHoliday.name}
                {selectedDayHoliday.is_no_school ? " · No School" : ""}
              </span>
            </span>
          )}
          {selectedDayNote && (
            <span className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-focus-amber/15 text-[12px] font-semibold text-focus-amber">
              <StickyNote className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{selectedDayNote.text}</span>
            </span>
          )}
          {selectedDayEvents.map(event => (
            <span
              key={event.id}
              className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-focus-pink/15 text-[12px] font-semibold text-focus-pink"
            >
              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {event.time ? `${formatTime12(event.time.slice(0, 5))} · ` : ""}
                {event.title}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
