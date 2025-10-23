import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, Target, TrendingUp, Sparkles, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-purple relative overflow-hidden">
      {/* Header */}
      <header className="container mx-auto px-6 pt-8 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[20px] bg-white flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-bold text-foreground">PetPals</span>
          </div>
          <Button 
            onClick={() => navigate("/dashboard")}
            className="bg-foreground hover:bg-foreground/90 text-white rounded-full px-6 h-11 font-medium"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-16 pb-20 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Let's Learn Now!
            </h1>
            <p className="text-xl text-foreground/70 mb-8 leading-relaxed">
              Build healthy routines with virtual pet companions that make learning fun and engaging for children.
            </p>
            <div className="flex gap-4">
              <Button 
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="bg-foreground hover:bg-foreground/90 text-white rounded-full px-8 h-14 text-lg font-medium"
              >
                <PlayCircle className="w-5 h-5 mr-2" />
                Start Learning
              </Button>
            </div>
          </div>

          {/* Right Column - Feature Card */}
          <div className="relative">
            <Card className="modern-card card-yellow p-8 border-0 relative overflow-hidden">
              <div className="mb-4">
                <h3 className="text-3xl font-bold text-foreground mb-2">Daily Tasks</h3>
                <p className="text-lg text-foreground/70">Complete & Earn Rewards</p>
              </div>
              <div className="flex items-center gap-3 mt-8">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                  <Target className="w-6 h-6 text-foreground" />
                </div>
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                  <Clock className="w-6 h-6 text-foreground" />
                </div>
                <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center text-white font-bold">
                  +5
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 pb-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Purple Card */}
          <Card className="modern-card card-purple p-8 border-0 hover:scale-105 transition-transform duration-300">
            <div className="w-14 h-14 rounded-[18px] bg-white flex items-center justify-center mb-6">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Smart Scheduling</h3>
            <p className="text-foreground/70 leading-relaxed">
              Visual calendars that kids can understand and follow easily
            </p>
          </Card>

          {/* White Card */}
          <Card className="modern-card bg-white p-8 border-0 hover:scale-105 transition-transform duration-300">
            <div className="w-14 h-14 rounded-[18px] bg-accent-purple flex items-center justify-center mb-6">
              <Sparkles className="w-7 h-7 text-primary-dark" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Pet Companions</h3>
            <p className="text-foreground/70 leading-relaxed">
              Choose from pandas, foxes, owls, and penguins
            </p>
          </Card>

          {/* Blue Card */}
          <Card className="modern-card card-blue p-8 border-0 hover:scale-105 transition-transform duration-300">
            <div className="w-14 h-14 rounded-[18px] bg-white flex items-center justify-center mb-6">
              <Target className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Goal Tracking</h3>
            <p className="text-foreground/70 leading-relaxed">
              Set and achieve daily goals with progress bars
            </p>
          </Card>

          {/* Green Card */}
          <Card className="modern-card card-green p-8 border-0 hover:scale-105 transition-transform duration-300">
            <div className="w-14 h-14 rounded-[18px] bg-white flex items-center justify-center mb-6">
              <TrendingUp className="w-7 h-7 text-success" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Progress Reports</h3>
            <p className="text-foreground/70 leading-relaxed">
              Parents track achievements and celebrate wins
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 pb-20 relative z-10">
        <Card className="modern-card bg-white max-w-3xl mx-auto p-12 md:p-16 border-0 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            From Basics to<br />Breakthroughs
          </h2>
          <p className="text-lg text-foreground/70 mb-8 max-w-xl mx-auto leading-relaxed">
            Start your child's journey to building better habits and learning responsibility through engaging tasks and rewards
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="bg-foreground hover:bg-foreground/90 text-white rounded-full px-10 h-14 text-lg font-medium"
            >
              Get Started Free
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-foreground/20 hover:bg-foreground/5 text-foreground rounded-full px-10 h-14 text-lg font-medium"
            >
              Learn More
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Index;
