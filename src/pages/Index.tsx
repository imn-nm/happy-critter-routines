import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PetAvatar from "@/components/PetAvatar";
import { Heart, Star, Users, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Heart, title: "Virtual Pet Companions", desc: "Cute pets that grow happier as children complete tasks" },
    { icon: Star, title: "Reward System", desc: "Earn coins for completing tasks and unlock special rewards" },
    { icon: Users, title: "Family Dashboard", desc: "Parents can manage schedules and track progress" },
    { icon: Clock, title: "Smart Scheduling", desc: "Flexible task management with timers and reminders" }
  ];

  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="text-center text-white mb-12">
          <h1 className="text-5xl font-bold mb-6">
            Make Daily Routines <br />
            <span className="text-accent-light">Fun & Rewarding</span>
          </h1>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Help your children build healthy habits with their very own virtual pet companion. 
            Complete tasks, earn coins, and keep your pet happy!
          </p>
          
          <div className="flex gap-4 justify-center mb-12">
            <Button 
              variant="accent" 
              size="xl"
              onClick={() => navigate("/")}
              className="font-semibold"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              Learn More
            </Button>
          </div>

          {/* Pet Showcase */}
          <div className="flex justify-center gap-8 mb-16">
            <div className="transform hover:scale-110 transition-transform duration-300">
              <PetAvatar petType="owl" happiness={95} size="lg" />
              <p className="mt-2 text-sm opacity-80">Wise Owl</p>
            </div>
            <div className="transform hover:scale-110 transition-transform duration-300">
              <PetAvatar petType="fox" happiness={88} size="lg" />
              <p className="mt-2 text-sm opacity-80">Clever Fox</p>
            </div>
            <div className="transform hover:scale-110 transition-transform duration-300">
              <PetAvatar petType="penguin" happiness={92} size="lg" />
              <p className="mt-2 text-sm opacity-80">Happy Penguin</p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 bg-white/90 backdrop-blur hover:bg-white transition-all duration-200 hover:scale-105">
              <feature.icon className="w-12 h-12 text-primary mb-4" />
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.desc}</p>
            </Card>
          ))}
        </div>

        {/* Preview Section */}
        <div className="text-center">
          <Card className="p-8 bg-white/95 backdrop-blur max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">How It Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">1</div>
                <h3 className="font-semibold mb-2">Create Your Child's Profile</h3>
                <p className="text-sm text-muted-foreground">Set up schedules, choose a pet companion, and add daily tasks</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-secondary rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">2</div>
                <h3 className="font-semibold mb-2">Complete Daily Tasks</h3>
                <p className="text-sm text-muted-foreground">Children complete tasks to earn coins and keep their pet happy</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-success rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">3</div>
                <h3 className="font-semibold mb-2">Track Progress & Rewards</h3>
                <p className="text-sm text-muted-foreground">Parents monitor progress and children unlock special rewards</p>
              </div>
            </div>

            <div className="mt-12">
              <Button 
                variant="gradient" 
                size="xl"
                onClick={() => navigate("/")}
                className="font-semibold"
              >
                Start Your Family's Journey
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
