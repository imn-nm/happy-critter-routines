import { Button } from "@/components/ui/button";
import { Clock, Calendar, Target, TrendingUp, Sparkles, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Calendar, title: "Smart Scheduling", desc: "Visual calendars kids understand", gradient: "from-purple-600/30 to-indigo-600/30" },
    { icon: Sparkles, title: "Pet Companions", desc: "Foxes & pandas to care for", gradient: "from-pink-600/30 to-purple-600/30" },
    { icon: Target, title: "Goal Tracking", desc: "Earn coins for every task", gradient: "from-blue-600/30 to-cyan-600/30" },
    { icon: TrendingUp, title: "Progress Reports", desc: "Track achievements over time", gradient: "from-emerald-600/30 to-teal-600/30" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center glow-purple">
              <Sparkles className="w-5 h-5 text-primary-light" />
            </div>
            <span className="text-xl font-bold text-foreground text-glow">PetPals</span>
          </div>
          <Button
            onClick={() => navigate("/dashboard")}
            size="sm"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-12 pb-16">
        <div className="max-w-lg mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Star className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-foreground/80">Built for families</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-[1.1] text-glow">
            Let's Build Great<br/>Routines!
          </h1>
          <p className="text-base text-muted-foreground mb-8 leading-relaxed max-w-md mx-auto">
            Help your children build healthy habits with virtual pets that grow happier as tasks get done.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="gap-2 text-base"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Feature Hero Card */}
        <div className="max-w-md mx-auto mb-10">
          <div className="glass-card rounded-3xl p-6 text-center">
            <div className="flex justify-center gap-4 mb-5">
              {["📚", "🎮", "🧩", "✏️"].map((emoji, i) => (
                <div key={i} className="w-14 h-14 rounded-2xl glass-strong flex items-center justify-center text-2xl hover:scale-110 transition-transform cursor-pointer">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="glass rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-foreground">Daily Tasks</h3>
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center glow-purple">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-primary/20 text-primary-light text-sm font-medium">
                  67%
                </div>
                <span className="text-sm text-muted-foreground">Complete & Earn Rewards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-card rounded-2xl p-5 hover:scale-[1.03] transition-transform cursor-pointer"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3`}>
                <feature.icon className="w-5 h-5 text-foreground/80" />
              </div>
              <h3 className="font-bold text-foreground text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 pb-16">
        <div className="max-w-md mx-auto text-center glass-card rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-glow">
            Ready to start?
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Set up your family in minutes. Free to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/dashboard")}>
              Create Account
            </Button>
            <Button variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
