import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHousehold } from "@/hooks/useHousehold";
import { toast } from "sonner";

/**
 * Set, change or turn off the parent PIN. Once a child's screen has been open
 * on a device, the PIN is asked for before the grown-up side opens there.
 */
const ParentPinSettings = () => {
  const { household, setParentPin, isSettingPin } = useHousehold();
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  if (!household) return null;
  const hasPin = !!household.parent_pin;

  const close = () => {
    setEditing(false);
    setPin("");
    setConfirm("");
    setError("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return setError("Use 4 to 6 digits.");
    if (pin !== confirm) return setError("The two PINs don't match.");
    try {
      await setParentPin(pin);
      toast.success(hasPin ? "PIN changed" : "PIN is on");
      close();
    } catch {
      /* the hook shows a toast */
    }
  };

  const turnOff = async () => {
    try {
      await setParentPin(null);
      toast.success("PIN is off");
    } catch {
      /* the hook shows a toast */
    }
  };

  const digits = (v: string) => v.replace(/\D/g, "");

  return (
    <section className="mx-sp-4 rounded-[28px] border border-[rgba(135,155,255,0.6)] bg-[rgba(135,155,255,0.2)] p-sp-4 flex flex-col gap-sp-3">
      <div className="flex items-center justify-between gap-sp-3">
        <h2 className="text-14 font-medium text-iris-400 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Parent PIN
        </h2>
        <span className="text-12 text-fog-200">{hasPin ? "On" : "Off"}</span>
      </div>
      <p className="text-12 text-fog-200 leading-snug">
        After your child's screen has been open on a device, this PIN is needed to get back to the grown-up side there.
      </p>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-sp-2">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="New PIN"
            placeholder="New PIN"
            value={pin}
            onChange={(e) => { setPin(digits(e.target.value)); setError(""); }}
            maxLength={6}
            autoFocus
          />
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Confirm PIN"
            placeholder="Confirm PIN"
            value={confirm}
            onChange={(e) => { setConfirm(digits(e.target.value)); setError(""); }}
            maxLength={6}
          />
          {error && <p className="text-12 text-coral-300" role="alert">{error}</p>}
          <div className="flex gap-sp-2">
            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={close}>Cancel</Button>
            <Button type="submit" size="sm" className="flex-1" disabled={isSettingPin}>Save PIN</Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-sp-2">
          <Button type="button" size="sm" onClick={() => setEditing(true)}>
            {hasPin ? "Change PIN" : "Set a PIN"}
          </Button>
          {hasPin && (
            <Button type="button" variant="secondary" size="sm" onClick={turnOff} disabled={isSettingPin}>
              Turn off
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

export default ParentPinSettings;
