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
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((stepNum) => (
              <div
                key={stepNum}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  stepNum <= step
                    ? "bg-white text-primary"
                    : "bg-white/30 text-white"
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

        <Card className="p-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Let's create your child's profile!</h2>
                <p className="text-muted-foreground">First, tell us about your child</p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <Label htmlFor="name">Child's Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name"
                    className="text-center text-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min="3"
                    max="18"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Enter age"
                    className="text-center text-lg"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Choose a Pet Companion</h3>
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                  {petTypes.map((pet) => (
                    <div
                      key={pet.type}
                      className={cn(
                        "p-4 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105",
                        formData.petType === pet.type
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "bg-muted/50 hover:bg-muted"
                      )}
                      onClick={() => setFormData({ ...formData, petType: pet.type as 'fox' | 'panda' })}
                    >
                      <PetAvatar petType={pet.type} happiness={85} size="md" className="mx-auto mb-2" />
                      <p className="text-sm font-medium text-center">{pet.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Sleep & Meal Times */}
          {step === 2 && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Set {formData.name}'s Schedule</h2>
                <p className="text-muted-foreground">When does {formData.name} wake up, sleep, and eat?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <Card className="p-4 bg-gradient-primary text-white">
                  <h3 className="font-semibold mb-4">Sleep Times</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/90">Wake Time</Label>
                      <Input
                        type="time"
                        value={formData.wakeTime}
                        onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                        className="bg-white/20 border-white/30 text-white placeholder-white/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white/90">Sleep Time</Label>
                      <Input
                        type="time"
                        value={formData.sleepTime}
                        onChange={(e) => setFormData({ ...formData, sleepTime: e.target.value })}
                        className="bg-white/20 border-white/30 text-white placeholder-white/70"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-secondary text-white">
                  <h3 className="font-semibold mb-4">Meal Times</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-white/90">Breakfast</Label>
                      <Input
                        type="time"
                        value={formData.breakfastTime}
                        onChange={(e) => setFormData({ ...formData, breakfastTime: e.target.value })}
                        className="bg-white/20 border-white/30 text-white placeholder-white/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white/90">Lunch</Label>
                      <Input
                        type="time"
                        value={formData.lunchTime}
                        onChange={(e) => setFormData({ ...formData, lunchTime: e.target.value })}
                        className="bg-white/20 border-white/30 text-white placeholder-white/70"
                      />
                    </div>
                    <div>
                      <Label className="text-white/90">Dinner</Label>
                      <Input
                        type="time"
                        value={formData.dinnerTime}
                        onChange={(e) => setFormData({ ...formData, dinnerTime: e.target.value })}
                        className="bg-white/20 border-white/30 text-white placeholder-white/70"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">All Set!</h2>
                <p className="text-muted-foreground">Ready to start {formData.name}'s journey?</p>
              </div>

              <div className="max-w-md mx-auto">
                <PetAvatar 
                  petType={formData.petType} 
                  happiness={100} 
                  size="xl" 
                  className="mx-auto mb-6" 
                />
                
                <Card className="p-6 bg-gradient-success text-white">
                  <h3 className="text-xl font-bold mb-4">{formData.name} & {petTypes.find(p => p.type === formData.petType)?.name}</h3>
                  <div className="space-y-2 text-sm">
                    <p>Age: {formData.age} years old</p>
                    <p>Wake up: {formData.wakeTime}</p>
                    <p>Bedtime: {formData.sleepTime}</p>
                  </div>
                </Card>
              </div>

              <p className="text-muted-foreground">
                Would you like to start adding tasks for {formData.name} now?
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={step === 1 ? () => navigate("/dashboard") : handleBack}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <Button
              variant="gradient"
              onClick={step === 3 ? handleFinish : handleNext}
              disabled={!isStepValid() || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? "Creating..." : step === 3 ? "Create Profile" : "Next"}
              {step < 3 && !isLoading && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChildSetup;