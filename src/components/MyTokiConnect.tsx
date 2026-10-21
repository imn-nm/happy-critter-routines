/**
 * The child's MyToki handhelds, in their settings: which ones get this child's day, when each was
 * last seen, and connecting a new one. Connecting shows the handheld's token once, with the
 * address it asks, to put into the handheld (for now through its build settings; device/README.md).
 */
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Caption } from "@/components/sheet/SheetParts";
import { choiceClass } from "@/components/sheet/sheetStyles";
import { MYTOKI_DEVICE_URL, useMyTokiDevices } from "@/hooks/useMyTokiDevices";

const CopyRow = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select it and copy by hand.");
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-12 font-medium leading-4 text-focus-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all rounded-[10px] bg-focus-bg px-2.5 py-2 text-12 leading-[17px] text-focus-text">{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} className={choiceClass(false, "rounded-[10px] h-9 w-9 min-h-9 shrink-0")}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
};

const MyTokiConnect = ({ childId, childName }: { childId: string; childName: string }) => {
  const { devices, loading, connect, disconnect } = useMyTokiDevices(childId);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    try {
      setToken(await connect());
    } catch (e) {
      console.error(e);
      toast.error("Couldn't connect a MyToki. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async (id: string) => {
    try {
      await disconnect(id);
      setToken(null);   // a code still showing may be this handheld's, now useless
      toast.success("Disconnected");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't disconnect it. Try again.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {devices.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-[14px] bg-focus-surface px-3.5 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold leading-5 text-focus-text">{d.name}</span>
            <span className="text-12 leading-4 text-focus-muted">
              {d.last_seen_at ? `Last seen ${formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true })}` : "Hasn't checked in yet"}
            </span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className={choiceClass(false, "rounded-[10px] px-3")}>Disconnect</button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect this MyToki?</AlertDialogTitle>
                <AlertDialogDescription>
                  It stops getting {childName}'s day until you connect it again with a new code.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDisconnect(d.id)}>Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}

      {token ? (
        <div className="flex flex-col gap-3 rounded-[14px] bg-focus-surface p-3.5">
          <p className="text-13 font-semibold leading-[18px] text-focus-text">
            Put these into the MyToki's settings. The code shows only now.
          </p>
          <CopyRow label="Device token" value={token} />
          <CopyRow label="Day plan URL and Events URL" value={MYTOKI_DEVICE_URL} />
          <button type="button" onClick={() => setToken(null)} className={choiceClass(false)}>Done</button>
        </div>
      ) : (
        <button type="button" onClick={onConnect} disabled={busy || loading} className={choiceClass(false)}>
          {devices.length ? "Connect another MyToki" : "Connect a MyToki"}
        </button>
      )}
      {!devices.length && !token && !loading && (
        <Caption>The MyToki handheld shows {childName}'s day and sends back what they do on it.</Caption>
      )}
    </div>
  );
};

export default MyTokiConnect;
