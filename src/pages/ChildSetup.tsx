import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PetAvatar, { type PetType } from "@/components/PetAvatar";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";

const petTypes: { type: PetType; name: string }[] = [
  { type: "fox", name: "Arctic Fox" },
  { type: "panda", name: "Red Panda" },
  { type: "owl", name: "Snowy Owl" },
];

const ChildSetup = () => {
  const navigate = useNavigate();
  const { addChild } = useChildren();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    petType: "fox" as 'fox' | 'panda' | 'owl',
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
        name: formData.name,
        age: parseInt(formData.age),
        petType: formData.petType as 'fox' | 'panda' | 'owl',
        currentCoins: 0,
        petHappiness: 50,
      });
      toast({ title: "Success!", description: `${formData.name} has been added!` });
      navigate("/dashboard");
    } catch (error) {
      toast({ title: "Error", description: "Failed to create profile.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const isStepValid = () => {
    if (step === 1) return formData.name && formData.age;
    if (step === 2) return formData.wakeTime && formData.sleepTime;
    return true;
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
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  stepNum < step
                    ? "bg-success text-white glow-green"
                    : stepNum === step
                    ? "bg-primary text-white glow-purple"
                    : "glass text-muted-foreground"
                )}
              >
                {stepNum < step ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={cn("w-10 h-0.5 rounded-full", stepNum < step ? "bg-success" : "bg-white/10")} />
              )}
            </div>
          ))}
        </div>

        <div className="glass-card rounded-3xl p-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground text-glow mb-1">Create a profile</h2>
                <p className="text-sm text-muted-foreground">Tell us about your child</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-foreground/80 text-sm font-medium mb-1.5 block">Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name"
                    className="h-11 rounded-xl bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <Label className="text-foreground/80 text-sm font-medium mb-1.5 block">Age</Label>
                  <Input
                    type="number" min="3" max="18"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Enter age"
                    className="h-11 rounded-xl bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-foreground/80 mb-3">Choose a pet</h3>
                <div className="grid grid-cols-2 gap-3">
                  {petTypes.map((pet) => (
                    <button
                      key={pet.type}
                      type="button"
                      className={cn(
                        "p-4 rounded-2xl transition-all duration-200 border-2",
                        formData.petType === pet.type
                          ? "border-primary glass-strong glow-purple"
                          : "border-white/5 glass hover:border-white/15"
                      )}
                      onClick={() => setFormData({ ...formData, petType: pet.type as 'fox' | 'panda' | 'owl' })}
                    >
                      <div className="glass rounded-full p-3 mb-2 mx-auto w-20 h-20 flex items-center justify-center">
                        <PetAvatar petType={pet.type} happiness={85} size="md" className="mx-auto" />
                      </div>
                      <p className="text-xs font-semibold text-center text-foreground">{pet.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground text-glow mb-1">{formData.name}'s schedule</h2>
                <p className="text-sm text-muted-foreground">Set daily routines</p>
              </div>

              <div className="space-y-3">
                <div className="glass rounded-2xl p-4">
                  <h3 className="font-medium text-foreground/80 text-sm mb-3">Sleep</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-muted-foreground text-xs mb-1 block">Wake up</Label>
                      <Input type="time" value={formData.wakeTime}
                        onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                        className="h-10 rounded-xl bg-white/5 border-white/10 text-sm text-foreground" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs mb-1 block">Bedtime</Label>
                      <Input type="time" value={formData.sleepTime}
                        onChange={(e) => setFormData({ ...formData, sleepTime: e.target.value })}
                        className="h-10 rounded-xl bg-white/5 border-white/10 text-sm text-foreground" />
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <h3 className="font-medium text-foreground/80 text-sm mb-3">Meals</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Breakfast", key: "breakfastTime" },
                      { label: "Lunch", key: "lunchTime" },
                      { label: "Dinner", key: "dinnerTime" },
                    ].map((meal) => (
                      <div key={meal.key} className="flex items-center justify-between">
                        <Label className="text-muted-foreground text-xs">{meal.label}</Label>
                        <Input type="time" value={formData[meal.key as keyof typeof formData]}
                          onChange={(e) => setFormData({ ...formData, [meal.key]: e.target.value })}
                          className="h-10 rounded-xl bg-white/5 border-white/10 text-sm text-foreground w-32" />
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
                <h2 className="text-xl font-bold text-foreground text-glow mb-1">All set!</h2>
                <p className="text-sm text-muted-foreground">Ready to create {formData.name}'s profile</p>
              </div>

              <div className="glass rounded-full w-24 h-24 mx-auto flex items-center justify-center glow-purple">
                <PetAvatar petType={formData.petType} happiness={100} size="xl" />
              </div>

              <div className="glass rounded-2xl p-4 text-left">
                <h3 className="font-bold text-foreground text-sm mb-2">
                  {formData.name} & {petTypes.find(p => p.type === formData.petType)?.name}
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Age: {formData.age} years old</p>
                  <p>Wake: {formData.wakeTime} &middot; Bed: {formData.sleepTime}</p>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
            <Button variant="ghost" size="sm" onClick={step === 1 ? () => navigate("/dashboard") : handleBack} className="gap-1.5">
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button size="sm" onClick={step === 3 ? handleFinish : handleNext} disabled={!isStepValid() || isLoading} className="gap-1.5">
              {isLoading ? "Creating..." : step === 3 ? "Create Profile" : "Next"}
              {step < 3 && !isLoading && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildSetup;
