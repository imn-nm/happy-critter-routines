import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, BookOpen, Star, TrendingUp, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle decorative shapes */}
      <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-soft-orange/10 soft-blob" />
      <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-soft-purple/10 soft-blob" />
      
      {/* Header */}
      <header className="container mx-auto px-6 pt-8 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">PetPals</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-foreground/70 hover:text-foreground"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-32 relative z-10">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Help your child build
            <br />
            <span className="text-primary">healthy routines</span>
          </h1>
          <p className="text-xl text-foreground/60 mb-8 leading-relaxed">
            A fun and engaging app that teaches children time management and responsibility through virtual pet companions.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-6 rounded-2xl text-lg font-medium shadow-none"
          >
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 pb-32 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl">
          {/* Feature 1 */}
          <Card className="p-8 rounded-3xl border-0 card-shadow bg-card hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-soft-orange/20 flex items-center justify-center mb-6">
              <Clock className="w-7 h-7 text-soft-orange" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-3">Task Scheduling</h3>
            <p className="text-sm text-foreground/60 leading-relaxed">
              Visual timelines help children understand their daily schedule
            </p>
          </Card>

          {/* Feature 2 */}
          <Card className="p-8 rounded-3xl border-0 card-shadow bg-card hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-soft-pink/20 flex items-center justify-center mb-6">
              <Sparkles className="w-7 h-7 text-soft-pink" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-3">Virtual Pets</h3>
            <p className="text-sm text-foreground/60 leading-relaxed">
              Adorable companions that respond to completed tasks
            </p>
          </Card>

          {/* Feature 3 */}
          <Card className="p-8 rounded-3xl border-0 card-shadow bg-card hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-soft-blue/20 flex items-center justify-center mb-6">
              <Star className="w-7 h-7 text-soft-blue" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-3">Reward System</h3>
            <p className="text-sm text-foreground/60 leading-relaxed">
              Earn coins and unlock achievements for consistency
            </p>
          </Card>

          {/* Feature 4 */}
          <Card className="p-8 rounded-3xl border-0 card-shadow bg-card hover:translate-y-[-4px] transition-transform duration-300">
            <div className="w-14 h-14 rounded-2xl bg-soft-green/20 flex items-center justify-center mb-6">
              <TrendingUp className="w-7 h-7 text-soft-green" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-3">Progress Tracking</h3>
            <p className="text-sm text-foreground/60 leading-relaxed">
              Parents can monitor growth and celebrate wins
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 pb-32 relative z-10">
        <Card className="max-w-4xl mx-auto p-12 md:p-16 rounded-3xl border-0 card-shadow bg-card text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to get started?
          </h2>
          <p className="text-lg text-foreground/60 mb-8 max-w-2xl mx-auto">
            Join families who are teaching their children valuable life skills through play
          </p>
          <Button 
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-6 rounded-2xl text-lg font-medium shadow-none"
          >
            Start Free Today
          </Button>
        </Card>
      </section>
    </div>
  );
};

export default Index;
