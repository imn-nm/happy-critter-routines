import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-[15px] font-semibold text-focus-text",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-11 w-11 bg-transparent p-0 text-focus-muted hover:text-focus-text"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-focus-muted rounded-md w-11 font-semibold text-12",
        row: "flex w-full mt-2",
        cell: "h-11 w-11 text-center text-14 p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-[14px] [&:has([aria-selected].day-outside)]:bg-focus-lavender/20 [&:has([aria-selected])]:bg-focus-lavender/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-11 w-11 p-0 font-normal text-focus-text aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-focus-lavender text-focus-bg font-semibold hover:bg-focus-lavender hover:text-focus-bg focus:bg-focus-lavender focus:text-focus-bg",
        day_today: "border border-focus-lime text-focus-lime",
        day_outside:
          "day-outside text-focus-muted opacity-50 aria-selected:bg-focus-lavender/20 aria-selected:text-focus-muted aria-selected:opacity-30",
        day_disabled: "text-focus-muted opacity-50",
        day_range_middle:
          "aria-selected:bg-focus-lavender/20 aria-selected:text-focus-text",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
