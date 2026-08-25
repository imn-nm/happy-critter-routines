import { Calendar, RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

const CalendarConnect = () => {
  const { status, isConnected, connect, syncNow, disconnect, syncing } =
    useGoogleCalendar();

  return (
    <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
      <h2 className="text-14 font-medium text-iris-400 flex items-center gap-2">
        <Calendar className="w-4 h-4" /> Google Calendar
      </h2>

      {isConnected ? (
        <>
          <p className="text-14 text-fog-50">
            Connected as <span className="text-iris-300">{status?.google_email ?? 'Google'}</span>
          </p>
          <p className="text-12 text-fog-200">
            Holidays and day notes are pushed to a calendar this app owns. Your other Google
            calendars are untouched.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => syncNow()} disabled={syncing} className="gap-1.5">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync now
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
          <p className="text-14 text-fog-200">
            Connect your Google Calendar to mirror holidays and day notes as calendar
            events. Each parent connects their own calendar.
          </p>
          <Button size="sm" onClick={() => connect()} className="self-start">
            Connect Google Calendar
          </Button>
        </>
      )}
    </section>
  );
};

export default CalendarConnect;
