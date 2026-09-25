import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHousehold } from "@/hooks/useHousehold";
import { isParentModeLocked, unlockParentMode } from "@/lib/parentLock";

/**
 * Wraps every grown-up route. After a child's screen has been open on this
 * device, the parent PIN is needed to get back in, however the page is
 * reached ("Grown-ups", Back, a bookmark). No PIN set: nothing to check.
 */
const ParentGate = () => {
  const navigate = useNavigate();
  const { household, isSuccess, isError, refetchHousehold } = useHousehold();
  const [locked, setLocked] = useState(isParentModeLocked);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (!locked) return <Outlet />;
  // Don't flash the dashboard while we find out whether there's a PIN
  // (including before sign-in has resolved, when the lookup hasn't started).
  if (!isSuccess && !isError) return null;
  // Couldn't find out: stay shut rather than wave a child through.
  const unknown = isError;
  if (!unknown && !household?.parent_pin) return <Outlet />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unknown) {
      refetchHousehold();
      return;
    }
    if (pin === household?.parent_pin) {
      unlockParentMode();
      setLocked(false);
    } else {
      setError("That's not the PIN. Try again.");
      setPin("");
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-sp-6"
      style={{ background: "radial-gradient(218% 145% at -22% -13%, #515AAD 13%, #452774 41%, #271447 65%, #08011A 100%)" }}
    >
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col items-center gap-sp-4 text-center">
        <span className="w-12 h-12 rounded-[16px] bg-iris-400/20 border border-iris-400/30 flex items-center justify-center">
          <Lock className="w-5 h-5 text-iris-200" />
        </span>
        <div>
          <h1 className="text-20 font-semibold text-fog-50">Grown-ups only</h1>
          <p className="mt-1 text-14 text-fog-200">
            {unknown ? "Couldn't check the PIN. Check the connection and try again." : "Enter the parent PIN to continue."}
          </p>
        </div>
        {!unknown && <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Parent PIN"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
          maxLength={6}
          autoFocus
          className="text-center text-2xl font-mono tracking-[0.4em]"
        />}
        <p className="min-h-5 text-12 text-coral-300" role="alert">{error}</p>
        <Button type="submit" variant="primary" size="md" className="w-full" disabled={!unknown && pin.length < 4}>
          {unknown ? "Try again" : "Unlock"}
        </Button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="tap-target min-h-11 text-14 text-fog-300 hover:text-fog-50"
        >
          Back to the kids' screen
        </button>
      </form>
    </div>
  );
};

export default ParentGate;
