import type { ReactNode } from "react";
import { BarChart3, Bell, CalendarCog, Eye, Shuffle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuickAccessMenuProps {
  /** The ••• button the menu drops down from. */
  children: ReactNode;
  childName: string;
  onEditSchedule: () => void;
  onActivityWheel: () => void;
  onReports: () => void;
  onChildView: () => void;
  alertCount: number;
  onAlerts: () => void;
}

/**
 * Quick access menu, opened from the ••• button on the child's schedule
 * page. It drops down right under the button and holds everything about the
 * child that isn't the day itself: schedule settings, the activity wheel,
 * reports, the child's own view and alerts.
 */
export default function QuickAccessMenu({
  children,
  childName,
  onEditSchedule,
  onActivityWheel,
  onReports,
  onChildView,
  alertCount,
  onAlerts,
}: QuickAccessMenuProps) {
  return (
    // Non-modal so a dialog opened from an item isn't blocked by the menu's
    // focus trap while the menu closes.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} aria-label={`More for ${childName}`}>
        <DropdownMenuItem onSelect={onEditSchedule}>
          <CalendarCog aria-hidden />
          Edit Schedule
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onActivityWheel}>
          <Shuffle aria-hidden />
          Activity Wheel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onReports}>
          <BarChart3 aria-hidden />
          Reports
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChildView}>
          <Eye aria-hidden />
          Child View
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onAlerts}>
          <Bell aria-hidden />
          <span className="flex-1">Alerts</span>
          {alertCount > 0 && (
            <span className="min-w-[24px] h-6 px-2 inline-flex items-center justify-center rounded-full bg-focus-alert text-[12px] font-semibold text-focus-bg">
              {alertCount}
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
