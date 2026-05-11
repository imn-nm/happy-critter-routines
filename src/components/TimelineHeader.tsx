import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { addDays, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { getPSTDate } from "@/utils/pstDate";
import { useHolidays } from "@/hooks/useHolidays";
import { Child } from "@/hooks/useChildren";
import { cn } from "@/lib/utils";

interface TimelineHeaderProps {
  child: Child;
  selectedDay: Date;
  onSelectedDayChange: (day: Date) => void;
}

/**
 * Date navigation row + holiday banner + week strip.
 *
 * Extracted from TimelineScheduleView so the parent (ChildDashboard) can
 * place this UI inside the iris-tinted "cabinet" panel above the schedule
 * rows. TimelineScheduleView is rendered alongside with `hideHeader` so
 * the actual events sit on the cosmic gradient below the panel.
 */
export default function TimelineHeader({
  child,
  selectedDay,
  onSelectedDayChange,
}: TimelineHeaderProps) {
  const [currentWeek, setCurrentWeek] = useState(selectedDay);
  const { isHoliday } = useHolidays(child.id);

  // Keep the visible week aligned to whatever day is selected externally.
  const selectedDayKey = format(selectedDay, "yyyy-MM-dd");
  useEffect(() => {
    setCurrentWeek(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayKey]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const selectedDayString = format(selectedDay, "yyyy-MM-dd");
  const selectedDayHoliday = isHoliday(selectedDayString);

  const formatWeekRange = (start: Date) => {
    const end = addDays(start, 6);
    const startMonth = format(start, "MMMM");
    const endMonth = format(end, "MMMM");
    const startDay = format(start, "d");
    const endDay = format(end, "d");
    const year = format(start, "yyyy");
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}–${endDay}, ${year}`;
    }
    return `${startMonth.slice(0, 3)} ${startDay} – ${endMonth.slice(0, 3)} ${endDay}, ${year}`;
  };

  const goToPreviousWeek = () => setCurrentWeek(prev => addDays(prev, -7));
  const goToNextWeek = () => setCurrentWeek(prev => addDays(prev, 7));

  return (
    <div className="flex flex-col gap-sp-4">
      {/* Date navigation row */}
      <div className="flex items-center justify-between gap-sp-3">
        <div className="flex items-center gap-sp-3 min-w-0">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={goToPreviousWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-16 text-[#9EBEFF] truncate">
            {formatWeekRange(weekStart)}
          </span>
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={goToNextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const pstToday = getPSTDate();
            onSelectedDayChange(pstToday);
            setCurrentWeek(pstToday);
          }}
          disabled={isToday(selectedDay)}
          className="shrink-0"
        >
          Today
        </Button>
      </div>

      {selectedDayHoliday && (
        <div className="flex items-center justify-center">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-pill text-14 font-medium"
            style={{
              backgroundColor: `${selectedDayHoliday.color}20`,
              color: selectedDayHoliday.color,
            }}
          >
            <PartyPopper className="w-4 h-4" />
            <span>{selectedDayHoliday.name}</span>
            {selectedDayHoliday.is_no_school && (
              <span className="ml-1 text-12 opacity-75">(No School)</span>
            )}
          </div>
        </div>
      )}

      {/* Week strip — matches Figma 145:6996.
          Selected day is wrapped in a white-glass pill (rgba(255,255,255,0.14)
          radius 58); inactive days use #9EBEFF for both the abbreviation
          (14px / 1.4) and the day number (18px / 1.15). */}
      <div className="flex items-center justify-between">
        {weekDays.map((day, index) => {
          const isSelected = isSameDay(day, selectedDay);
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectedDayChange(day)}
              className={cn(
                "flex flex-col items-center justify-center gap-sp-3 p-2 rounded-[58px] transition-colors",
                isSelected ? "bg-[rgba(255,255,255,0.14)]" : "hover:bg-white/[0.04]",
              )}
            >
              <span
                className={cn(
                  "text-14",
                  isSelected ? "text-fog-50" : "text-[#9EBEFF]",
                )}
                style={{ lineHeight: 1.4 }}
              >
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][index]}
              </span>
              <span
                className={cn(
                  "text-18 tabular-nums",
                  isSelected ? "text-fog-50" : "text-[#9EBEFF]",
                )}
                style={{ lineHeight: 1.15 }}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
