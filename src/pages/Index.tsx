import { Button } from "@/components/ui/button";
import { Clock, Calendar, Target, TrendingUp, Sparkles, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Calendar, title: "Smart Scheduling", desc: "Visual calendars kids understand", gradient: "bg-focus-lavender/20 text-focus-lavender" },
    { icon: Sparkles, title: "Pet Companions", desc: "Foxes & pandas to care for", gradient: "bg-focus-pink/20 text-focus-pink" },
    { icon: Target, title: "Goal Tracking", desc: "Stars from you for a job well done", gradient: "bg-focus-iris/20 text-focus-iris" },
    { icon: TrendingUp, title: "Progress Reports", desc: "Track achievements over time", gradient: "bg-focus-mint/20 text-focus-mint" },
  ];

  return (
    <div className="min-h-dvh">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[14px] bg-focus-surface flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-focus-lavender" />
            </div>
            <span className="text-20 font-bold text-focus-text">PetPals</span>
          </div>
          <Button
            onClick={() => navigate("/parent")}
            size="sm"
            variant="secondary"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-12 pb-16">
        <div className="max-w-lg mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-focus-surface mb-6">
            <Star className="w-4 h-4 text-focus-lime fill-focus-lime" strokeWidth={0} />
            <span className="text-14 font-semibold text-focus-muted">Built for Families</span>
          </div>
          <h1 className="text-40 md:text-56 font-bold text-focus-text mb-4 leading-[1.1]">
            Let's Build Great<br/>Routines!
          </h1>
          <p className="text-16 text-focus-muted mb-8 leading-relaxed max-w-md mx-auto">
            Help your children build healthy habits with virtual pets that grow happier as tasks get done.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/parent")}
            className="gap-2"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Feature Hero Card */}
        <div className="max-w-md mx-auto mb-10">
          <div className="bg-focus-surface rounded-[24px] p-6 text-center">
            <div className="flex justify-center gap-4 mb-5">
              {["📚", "🎮", "🧩", "✏️"].map((emoji, i) => (
                <div key={i} className="w-14 h-14 rounded-[18px] bg-focus-sunken flex items-center justify-center text-24">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="bg-focus-raised rounded-[20px] p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-18 font-bold text-focus-text">Daily Tasks</h3>
                <div className="w-9 h-9 rounded-full bg-focus-lavender flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-focus-bg" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-focus-mint/20 text-focus-mint text-14 font-medium">
                  67%
                </div>
                <span className="text-14 text-focus-muted">Complete & Earn Rewards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-focus-surface rounded-[24px] p-5"
            >
              <div className={`w-11 h-11 rounded-[14px] ${feature.gradient} flex items-center justify-center mb-3`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-focus-text text-14 mb-1">{feature.title}</h3>
              <p className="text-12 text-focus-muted leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 pb-16">
        <div className="max-w-md mx-auto text-center bg-focus-surface rounded-[24px] p-8">
          <h2 className="text-24 font-bold text-focus-text mb-2">
            Ready to Start?
          </h2>
          <p className="text-focus-muted text-14 mb-6">
            Set up your family in minutes. Free to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/parent")}>
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
