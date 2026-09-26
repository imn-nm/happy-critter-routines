import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Calendar, RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useHousehold } from '@/hooks/useHousehold';
import { onCalendarSyncChange, readCalendarSync, type CalendarSyncStatus } from '@/utils/calendarSyncStatus';

const CalendarConnect = () => {
  const { status, isConnected, connect, syncNow, disconnect, syncing } =
    useGoogleCalendar();
  const { household } = useHousehold();
  // The last sync from this device: "Connected" alone hid a calendar that had
  // stopped updating.
  const [lastSync, setLastSync] = useState<CalendarSyncStatus | null>(null);
  useEffect(() => {
    if (!household) return;
    const load = () => setLastSync(readCalendarSync(household.id));
    load();
    return onCalendarSyncChange(load);
  }, [household]);

  return (
    <section className="mx-sp-4 rounded-[24px] bg-focus-surface p-sp-4 flex flex-col gap-sp-3">
      <h2 className="text-14 font-semibold text-focus-text flex items-center gap-2">
        <Calendar className="w-4 h-4" /> Google Calendar
      </h2>

      {isConnected ? (
        <>
          <p className="text-14 text-focus-text">
            Connected as <span className="text-focus-lavender">{status?.google_email ?? 'Google'}</span>
          </p>
          <p className="text-12 text-focus-muted">
            Holidays and day notes are pushed to a calendar this app owns. Your other Google
            calendars are untouched.
          </p>
          {lastSync && (lastSync.ok ? (
            <p className="text-12 text-focus-muted">
              Last synced {formatDistanceToNow(new Date(lastSync.at), { addSuffix: true })}
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-[20px] border border-focus-amber/40 bg-focus-amber/10 p-sp-3" role="alert">
              <p className="text-13 text-focus-text flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-focus-amber shrink-0 mt-0.5" />
                <span>
                  The last sync didn't work ({formatDistanceToNow(new Date(lastSync.at), { addSuffix: true })}): {lastSync.message}
                </span>
              </p>
              <Button size="sm" variant="secondary" onClick={() => connect()} className="self-start">
                Reconnect
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => syncNow()} disabled={syncing} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => disconnect()}
              className="gap-1.5"
            >
              <Unplug className="w-4 h-4" /> Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-14 text-focus-muted">
            Connect your Google Calendar to mirror holidays and day notes as calendar
            events. Each parent connects their own calendar.
          </p>
          <Button size="sm" variant="secondary" onClick={() => connect()} className="self-start">
            Connect Google Calendar
          </Button>
        </>
      )}
    </section>
  );
};

export default CalendarConnect;
