import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHousehold } from "@/hooks/useHousehold";
import { toast } from "sonner";

interface PincodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Two modes:
//   setup: household has no PIN yet → ask user to set one (enter twice).
//   verify: household has a PIN → ask user to enter it to enter parent portal.
const PincodeDialog = ({ open, onOpenChange }: PincodeDialogProps) => {
  const navigate = useNavigate();
  const { household, setParentPin, isSettingPin, verifyParentPin } = useHousehold();
  const isSetupMode = !!household && !household.has_parent_pin;

  const [pincode, setPincode] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  // Reset state whenever the dialog reopens.
  useEffect(() => {
    if (open) {
      setPincode("");
      setConfirmPin("");
      setError("");
    }
  }, [open]);

  const reset = () => {
    setPincode("");
    setConfirmPin("");
    setError("");
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pincode)) {
      setError("PIN must be 4–6 digits.");
      return;
    }
    if (pincode !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    try {
      await setParentPin(pincode);
      toast.success("Parent PIN set");
      onOpenChange(false);
      reset();
      navigate("/parent");
    } catch {
      // toast shown by hook
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyParentPin(pincode).catch(() => false)) {
      onOpenChange(false);
      reset();
      navigate("/parent");
    } else {
      setError("Incorrect pincode");
      setPincode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-18 sm:text-20">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-focus-muted" />
            {isSetupMode ? "Set Parent PIN" : "Parent Access"}
          </DialogTitle>
          <DialogDescription className="text-14">
            {isSetupMode
              ? "Pick a 4–6 digit PIN to keep the parent dashboard safe from little hands."
              : "Enter the parent pincode to access the dashboard"}
          </DialogDescription>
        </DialogHeader>

        {isSetupMode ? (
          <form onSubmit={handleSetup} className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="New PIN"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-20 sm:text-24 font-mono tracking-wider py-3"
              maxLength={6}
              autoFocus
            />
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-20 sm:text-24 font-mono tracking-wider py-3"
              maxLength={6}
            />
            {error && (
              <p className="text-focus-coral text-14 text-center">{error}</p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              disabled={isSettingPin}
            >
              {isSettingPin ? "Saving…" : "Set PIN"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Enter pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-20 sm:text-24 font-mono tracking-wider py-3"
                maxLength={6}
                autoFocus
              />
              {error && (
                <p className="text-focus-coral text-14 mt-2 text-center">{error}</p>
              )}
            </div>

            <Button type="submit" variant="primary" size="md" className="w-full">
              <span className="hidden sm:inline">Access Dashboard</span>
              <span className="sm:hidden">Access</span>
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PincodeDialog;
