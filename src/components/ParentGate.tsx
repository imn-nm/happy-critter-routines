import { useEffect, useState } from "react";
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
  const { household, isSuccess, isError, refetchHousehold, verifyParentPin } = useHousehold();
  const [locked, setLocked] = useState(isParentModeLocked);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  // After a few wrong guesses, pause before the next try: 10,000 four-digit
  // PINs are a lot of taps when each miss costs half a minute.
  const [misses, setMisses] = useState(0);
  const [pausedUntil, setPausedUntil] = useState(0);
  const [, setTick] = useState(0);
  const paused = pausedUntil > Date.now();
  useEffect(() => {
    if (!paused) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);

  if (!locked) return <Outlet />;
  // Don't flash the dashboard while we find out whether there's a PIN
  // (including before sign-in has resolved, when the lookup hasn't started).
  if (!isSuccess && !isError) return null;
  // Couldn't find out: stay shut rather than wave a child through.
  const unknown = isError;
  if (!unknown && !household?.has_parent_pin) return <Outlet />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unknown) {
      refetchHousehold();
      return;
    }
    if (paused || checking) return;
    setChecking(true);
    try {
      if (await verifyParentPin(pin)) {
        unlockParentMode();
        setLocked(false);
        return;
      }
      const next = misses + 1;
      setMisses(next);
      setPin("");
      if (next % 5 === 0) {
        setPausedUntil(Date.now() + 30_000);
        setError("Too many tries. Wait 30 seconds.");
      } else {
        setError("That's not the PIN. Try again.");
      }
    } catch {
      setError("Couldn't check the PIN. Check the connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-sp-6 bg-focus-bg"
    >
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col items-center gap-sp-4 text-center">
        <span className="w-12 h-12 rounded-[16px] bg-focus-surface flex items-center justify-center">
          <Lock className="w-5 h-5 text-focus-muted" />
        </span>
        <div>
          <h1 className="text-20 font-bold text-focus-text">Grown-Ups Only</h1>
          <p className="mt-1 text-14 text-focus-muted">
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
          className="text-center text-24 font-mono tracking-[0.4em]"
        />}
        <p className="min-h-5 text-12 text-focus-coral" role="alert">{error}</p>
        <Button type="submit" variant="primary" size="md" className="w-full" disabled={!unknown && (pin.length < 4 || paused || checking)}>
          {unknown ? "Try Again" : "Unlock"}
        </Button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="tap-target min-h-11 text-14 text-focus-muted hover:text-focus-text"
        >
          Back to the Kids' Screen
        </button>
      </form>
    </div>
  );
};

export default ParentGate;
