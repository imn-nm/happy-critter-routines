import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PetAvatar from "@/components/PetAvatar";
import CritterPicker from "@/components/critters/CritterPicker";
import { getCritter, type CritterId } from "@/components/critters/pixelCharacters";
import TimeSelect from "@/components/TimeSelect";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";
import { formatTime12 } from "@/utils/formatTime";

const ChildSetup = () => {
  const navigate = useNavigate();
  const { addChild } = useChildren();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    petType: "fox" as CritterId,
    wakeTime: "07:00",
    sleepTime: "20:00",
    breakfastTime: "07:30",
    lunchTime: "12:00",
    dinnerTime: "18:00",
  });

  const handleNext = () => { if (step < 3) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      await addChild({
        name: formData.name.trim(),
        age: parseInt(formData.age),
        petType: formData.petType,
        currentCoins: 0,
        petHappiness: 50,
      });
      toast({ title: "Success!", description: `${formData.name} has been added!` });
      navigate("/parent");
    } catch (error) {
      toast({ title: "Error", description: "Failed to create profile.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const isStepValid = () => {
    if (step === 1) {
      const age = parseInt(formData.age, 10);
      return formData.name.trim().length > 0 && !isNaN(age) && age >= 3 && age <= 18;
    }
    if (step === 2) return formData.wakeTime && formData.sleepTime;
    return true;
  };

  const handleCancel = () => {
    // Confirm before discarding if the user has started entering anything.
    if (step > 1 || formData.name.trim() || formData.age) {
      setShowDiscardConfirm(true);
    } else {
      navigate("/parent");
    }
  };

  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  stepNum < step
                    ? "bg-mint-500 text-white"
                    : stepNum === step
                    ? "bg-iris-400 text-white"
                    : "border border-iris-400/30 text-fog-400"
                )}
              >
                {stepNum < step ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={cn("w-10 h-0.5 rounded-full", stepNum < step ? "bg-mint-500" : "bg-white/10")} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-[28px] border border-[rgba(102,153,255,0.25)] bg-iris-400/[0.06] p-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-fog-50 mb-1">Create a profile</h2>
                <p className="text-sm text-muted-foreground">Tell us about your child</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-fog-200 text-sm font-medium mb-1.5 block">Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="text-fog-200 text-sm font-medium mb-1.5 block">Age</Label>
                  <Input
                    type="number" min="3" max="18"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Enter age"
                    className="h-11"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-fog-200 mb-3">Choose a pet</h3>
                <CritterPicker
                  value={formData.petType}
                  onChange={(id) => setFormData({ ...formData, petType: id })}
                />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-fog-50 mb-1 truncate">{formData.name}'s schedule</h2>
                <p className="text-sm text-muted-foreground">Set daily routines</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-iris-400/20 p-4">
                  <h3 className="font-medium text-fog-200 text-sm mb-3">Sleep</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-muted-foreground text-xs mb-1 block">Wake up</Label>
                      <TimeSelect value={formData.wakeTime}
                        onChange={(v) => setFormData({ ...formData, wakeTime: v })} />
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs mb-1 block">Bedtime</Label>
                      <TimeSelect value={formData.sleepTime}
                        onChange={(v) => setFormData({ ...formData, sleepTime: v })} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-iris-400/20 p-4">
                  <h3 className="font-medium text-fog-200 text-sm mb-3">Meals</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Breakfast", key: "breakfastTime" },
                      { label: "Lunch", key: "lunchTime" },
                      { label: "Dinner", key: "dinnerTime" },
                    ].map((meal) => (
                      <div key={meal.key} className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-xs">{meal.label}</Label>
                        <TimeSelect value={formData[meal.key as keyof typeof formData]}
                          onChange={(v) => setFormData({ ...formData, [meal.key]: v })}
                          className="shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="text-center space-y-5">
              <div>
                <h2 className="text-xl font-bold text-fog-50 mb-1">All set!</h2>
                <p className="text-sm text-muted-foreground">Ready to create {formData.name}'s profile</p>
              </div>

              {/* size="xl" is a 192px sprite — it burst out of this circle and
                  overlapped the heading and summary card. "md" (80px) fits. */}
              <div className="rounded-full w-28 h-28 mx-auto flex items-center justify-center bg-iris-400/10 shrink-0">
                <PetAvatar petType={formData.petType} happiness={100} size="md" />
              </div>

              <div className="rounded-2xl border border-iris-400/20 p-4 text-left">
                <h3 className="font-bold text-fog-50 text-sm mb-2 truncate">
                  {formData.name} & {getCritter(formData.petType)?.name}
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Age: {formData.age} years old</p>
                  <p>Wake: {formatTime12(formData.wakeTime)} &middot; Bed: {formatTime12(formData.sleepTime)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
            <Button variant="ghost" size="sm" onClick={step === 1 ? handleCancel : handleBack} className="gap-1.5">
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button variant="primary" size="sm" onClick={step === 3 ? handleFinish : handleNext} disabled={!isStepValid() || isLoading} className="gap-1.5">
              {isLoading ? "Creating..." : step === 3 ? "Create Profile" : "Next"}
              {step < 3 && !isLoading && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard setup?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything you've entered so far will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/parent")}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChildSetup;
