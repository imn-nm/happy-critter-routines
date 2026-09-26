import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when the family couldn't be loaded (offline, server down), so a
 * network blip never looks like "no children yet" and invites setting up a
 * duplicate profile. Retries on its own every little while.
 */
const LoadErrorCard = ({ onRetry }: { onRetry: () => void }) => {
  useEffect(() => {
    const id = window.setInterval(onRetry, 15_000);
    return () => window.clearInterval(id);
  }, [onRetry]);
  return (
    <div className="min-h-dvh flex items-center justify-center p-sp-6">
      <div className="max-w-xs flex flex-col items-center gap-sp-4 text-center" role="status">
        <span className="w-12 h-12 rounded-[16px] bg-focus-surface flex items-center justify-center">
          <WifiOff className="w-5 h-5 text-focus-muted" />
        </span>
        <h1 className="text-20 font-bold text-focus-text">We Couldn't Load Your Family</h1>
        <p className="text-14 text-focus-muted">Check the connection. We'll keep trying.</p>
        <Button variant="secondary" size="md" onClick={onRetry}>Try Again</Button>
      </div>
    </div>
  );
};

export default LoadErrorCard;
