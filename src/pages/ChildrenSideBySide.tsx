import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Sparkles } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import PincodeDialog from "@/components/PincodeDialog";
import ChildInterface from "./ChildInterface";

const ChildrenSideBySide = () => {
  const { children, loading } = useChildren();
  const [showPincodeDialog, setShowPincodeDialog] = useState(false);

  const ParentButton = () => (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={() => setShowPincodeDialog(true)}
        variant="outline"
        size="sm"
        className="rounded-full px-4 h-9 gap-1.5"
      >
        <Settings className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Parent</span>
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen p-4">
        <ParentButton />
        <div className="max-w-md mx-auto text-center pt-24">
          <div className="w-20 h-20 rounded-3xl glass-strong flex items-center justify-center mx-auto mb-6 glow-purple">
            <Sparkles className="w-9 h-9 text-primary-light" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3 text-glow">Welcome to Taskie!</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            No children profiles yet. Tap Parent to set up your first profile.
          </p>
        </div>

        <PincodeDialog
          open={showPincodeDialog}
          onOpenChange={setShowPincodeDialog}
        />
      </div>
    );
  }

  if (children.length === 1) {
    return (
      <div className="min-h-screen relative">
        <ParentButton />
        <ChildInterface childId={children[0].id} />
        <PincodeDialog
          open={showPincodeDialog}
          onOpenChange={setShowPincodeDialog}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParentButton />

      <div className="h-screen flex flex-col lg:flex-row">
        {children.slice(0, 2).map((child, index) => (
          <div
            key={child.id}
            className={`flex-1 ${
              index === 0 ? "border-b lg:border-b-0 lg:border-r border-white/5" : ""
            }`}
          >
            <ChildInterface childId={child.id} />
          </div>
        ))}
      </div>

      {children.length > 2 && (
        <div className="fixed bottom-3 left-1/2 transform -translate-x-1/2 z-10 px-4">
          <div className="glass rounded-2xl px-4 py-2">
            <p className="text-xs text-muted-foreground text-center">
              Showing 2 children. Use Parent Dashboard for all.
            </p>
          </div>
        </div>
      )}

      <PincodeDialog
        open={showPincodeDialog}
        onOpenChange={setShowPincodeDialog}
      />
    </div>
  );
};

export default ChildrenSideBySide;
