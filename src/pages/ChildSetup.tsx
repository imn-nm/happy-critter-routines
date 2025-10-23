import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PetAvatar, { type PetType } from "@/components/PetAvatar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useChildren } from "@/hooks/useChildren";
import { useToast } from "@/hooks/use-toast";

const petTypes: { type: PetType; name: string }[] = [
  { type: "fox", name: "Arctic Fox" },
  { type: "panda", name: "Red Panda" },
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
    petType: "fox" as 'fox' | 'panda',
    wakeTime: "07:00",
    sleepTime: "20:00",
    breakfastTime: "07:30",
    lunchTime: "12:00",
    dinnerTime: "18:00",
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Convert form data to match database structure
      const childData = {
        name: formData.name,
        age: parseInt(formData.age),
        petType: formData.petType as 'fox' | 'panda',
        currentCoins: 0,
        petHappiness: 50,
      };
      
      console.log("Creating child:", formData);
      await addChild(childData);
      
      toast({
        title: "Success!",
        description: `${formData.name} has been added successfully!`,
      });
      
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating child:", error);
      toast({
        title: "Error",
        description: "Failed to create child profile. Please try again.",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-gradient-primary p-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-3">
            {[1, 2, 3].map((stepNum) => (
              <div
                key={stepNum}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold transition-all",
                  stepNum <= step
                    ? "bg-white text-primary shadow-md scale-110"
                    : "bg-white/30 text-white/70"
                )}
              >
                {stepNum}
              </div>
            ))}
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white h-full rounded-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        <Card className="p-6 sm:p-8 bg-white rounded-3xl shadow-lg border-0">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Let's create your child's profile!</h2>
                <p className="text-muted-foreground text-sm">First, tell us about your child</p>
              </div>

              <div className="space-y-5">
                <div className="text-left">
                  <Label htmlFor="name" className="text-foreground font-semibold text-base mb-2 block">Child's Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name"
                    className="text-center text-base h-12 rounded-2xl bg-accent/30 border-0 text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="text-left">
                  <Label htmlFor="age" className="text-foreground font-semibold text-base mb-2 block">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min="3"
                    max="18"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Enter age"
                    className="text-center text-base h-12 rounded-2xl bg-accent/30 border-0 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Choose a Pet Companion</h3>
                <div className="grid grid-cols-2 gap-3">
                  {petTypes.map((pet) => (
                    <button
                      key={pet.type}
                      type="button"
                      className={cn(
                        "p-4 rounded-3xl cursor-pointer transition-all duration-200 hover:scale-105 border-2",
                        formData.petType === pet.type
                          ? "bg-primary/10 border-primary ring-2 ring-primary shadow-md"
                          : "bg-accent/20 border-accent/40 hover:border-primary/40"
                      )}
                      onClick={() => setFormData({ ...formData, petType: pet.type as 'fox' | 'panda' })}
                    >
                      <div className="bg-white rounded-full p-3 mb-3 mx-auto w-24 h-24 flex items-center justify-center shadow-sm">
                        <PetAvatar petType={pet.type} happiness={85} size="md" className="mx-auto" />
                      </div>
                      <p className="text-sm font-semibold text-center text-foreground">{pet.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Sleep & Meal Times */}
          {step === 2 && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Set {formData.name}'s Schedule</h2>
                <p className="text-muted-foreground text-sm">When does {formData.name} wake up, sleep, and eat?</p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-3xl" style={{ background: 'hsl(var(--accent-purple))' }}>
                  <h3 className="font-semibold text-foreground mb-4 text-left">Sleep Times</h3>
                  <div className="space-y-4">
                    <div className="text-left">
                      <Label className="text-foreground/80 text-sm mb-1.5 block">Wake Time</Label>
                      <Input
                        type="time"
                        value={formData.wakeTime}
                        onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                        className="h-12 rounded-2xl bg-white/80 border-0 text-foreground"
                      />
                    </div>
                    <div className="text-left">
                      <Label className="text-foreground/80 text-sm mb-1.5 block">Sleep Time</Label>
                      <Input
                        type="time"
                        value={formData.sleepTime}
                        onChange={(e) => setFormData({ ...formData, sleepTime: e.target.value })}
                        className="h-12 rounded-2xl bg-white/80 border-0 text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-3xl" style={{ background: 'hsl(var(--accent-blue))' }}>
                  <h3 className="font-semibold text-foreground mb-4 text-left">Meal Times</h3>
                  <div className="space-y-4">
                    <div className="text-left">
                      <Label className="text-foreground/80 text-sm mb-1.5 block">Breakfast</Label>
                      <Input
                        type="time"
                        value={formData.breakfastTime}
                        onChange={(e) => setFormData({ ...formData, breakfastTime: e.target.value })}
                        className="h-12 rounded-2xl bg-white/80 border-0 text-foreground"
                      />
                    </div>
                    <div className="text-left">
                      <Label className="text-foreground/80 text-sm mb-1.5 block">Lunch</Label>
                      <Input
                        type="time"
                        value={formData.lunchTime}
                        onChange={(e) => setFormData({ ...formData, lunchTime: e.target.value })}
                        className="h-12 rounded-2xl bg-white/80 border-0 text-foreground"
                      />
                    </div>
                    <div className="text-left">
                      <Label className="text-foreground/80 text-sm mb-1.5 block">Dinner</Label>
                      <Input
                        type="time"
                        value={formData.dinnerTime}
                        onChange={(e) => setFormData({ ...formData, dinnerTime: e.target.value })}
                        className="h-12 rounded-2xl bg-white/80 border-0 text-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">All Set!</h2>
                <p className="text-muted-foreground text-sm">Ready to start {formData.name}'s journey?</p>
              </div>

              <div>
                <div className="bg-white rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <PetAvatar 
                    petType={formData.petType} 
                    happiness={100} 
                    size="xl" 
                  />
                </div>
                
                <div className="p-6 rounded-3xl" style={{ background: 'hsl(var(--success))' }}>
                  <h3 className="text-xl font-bold mb-4 text-white">{formData.name} & {petTypes.find(p => p.type === formData.petType)?.name}</h3>
                  <div className="space-y-2 text-sm text-white/90">
                    <p className="font-medium">Age: {formData.age} years old</p>
                    <p className="font-medium">Wake up: {formData.wakeTime}</p>
                    <p className="font-medium">Bedtime: {formData.sleepTime}</p>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground text-sm">
                Would you like to start adding tasks for {formData.name} now?
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-border/30">
            <Button
              variant="ghost"
              onClick={step === 1 ? () => navigate("/dashboard") : handleBack}
              className="flex items-center gap-2 text-foreground hover:bg-muted rounded-xl h-11 px-4"
            >
              <ChevronLeft className="w-5 h-5" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <Button
              onClick={step === 3 ? handleFinish : handleNext}
              disabled={!isStepValid() || isLoading}
              className="flex items-center gap-2 h-11 px-6 rounded-xl font-semibold shadow-md"
              style={{ background: 'hsl(var(--primary))' }}
            >
              {isLoading ? "Creating..." : step === 3 ? "Create Profile" : "Next"}
              {step < 3 && !isLoading && <ChevronRight className="w-5 h-5" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChildSetup;