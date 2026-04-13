import { useState } from "react";
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

interface PincodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PincodeDialog = ({ open, onOpenChange }: PincodeDialogProps) => {
  const [pincode, setPincode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handlePincodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pincode === "8287") {
      onOpenChange(false);
      setPincode("");
      setError("");
      navigate("/dashboard");
    } else {
      setError("Incorrect pincode");
      setPincode("");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPincode("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
            Parent Access
          </DialogTitle>
          <DialogDescription className="text-sm">
            Enter the parent pincode to access the dashboard
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handlePincodeSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Enter pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="text-center text-xl sm:text-2xl font-mono tracking-wider py-3"
              maxLength={4}
              autoFocus
            />
            {error && (
              <p className="text-destructive text-sm mt-2 text-center">{error}</p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 w-full"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 w-full">
              <span className="hidden sm:inline">Access Dashboard</span>
              <span className="sm:hidden">Access</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PincodeDialog;