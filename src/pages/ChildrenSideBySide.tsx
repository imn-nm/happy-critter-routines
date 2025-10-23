import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { useChildren } from "@/hooks/useChildren";
import PincodeDialog from "@/components/PincodeDialog";
import ChildInterface from "./ChildInterface";

const ChildrenSideBySide = () => {
  const { children, loading } = useChildren();
  const [showPincodeDialog, setShowPincodeDialog] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="text-center py-8 text-white">Loading children interfaces...</div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-16 px-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Welcome to Taskie!</h1>
            <p className="text-white/80 mb-8 text-sm sm:text-base">No children profiles found. Please use the parent dashboard to set up children profiles.</p>
          </div>
        </div>

        <PincodeDialog
          open={showPincodeDialog}
          onOpenChange={setShowPincodeDialog}
        />
      </div>
    );
  }

  if (children.length === 1) {
    // Single child - use full width
    return (
      <div className="min-h-screen bg-gradient-primary relative">
        {/* Single Parent Button - Top Right */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={() => setShowPincodeDialog(true)}
            variant="outline"
            className="rounded-full px-3 py-1.5 h-auto border-2 border-foreground/20 bg-white flex items-center gap-1.5 shadow-lg"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Parent</span>
          </Button>
        </div>

        {/* Single Child Interface */}
        <ChildInterface childId={children[0].id} />

        <PincodeDialog
          open={showPincodeDialog}
          onOpenChange={setShowPincodeDialog}
        />
      </div>
    );
  }

  // Multiple children - responsive layout
  return (
    <div className="min-h-screen bg-gradient-primary relative">
      {/* Single Parent Button - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setShowPincodeDialog(true)}
          variant="outline"
          className="rounded-full px-3 py-1.5 h-auto border-2 border-foreground/20 bg-white flex items-center gap-1.5 shadow-lg"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Parent</span>
        </Button>
      </div>

      {/* Responsive Children Interfaces Layout */}
      <div className="h-screen flex flex-col lg:flex-row">
        {children.slice(0, 2).map((child, index) => (
          <div
            key={child.id}
            className={`flex-1 ${
              index === 0 ? "border-b lg:border-b-0 lg:border-r border-white/20" : ""
            }`}
          >
            <ChildInterface childId={child.id} />
          </div>
        ))}
      </div>

      {/* Show message if more than 2 children */}
      {children.length > 2 && (
        <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 z-10 px-4">
          <Card className="p-2 sm:p-3 bg-white/90 backdrop-blur max-w-xs sm:max-w-none">
            <p className="text-xs sm:text-sm text-center">
              Showing first 2 children. Use Parent Dashboard to access all children.
            </p>
          </Card>
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