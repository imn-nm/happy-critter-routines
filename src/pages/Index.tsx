import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PetAvatar from "@/components/PetAvatar";
import { Heart, Star, Users, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50 relative overflow-hidden">
      {/* Decorative organic shapes */}
      <div className="absolute top-20 right-10 w-32 h-32 blob-purple organic-shape opacity-40" />
      <div className="absolute top-[40%] left-10 w-40 h-40 blob-green organic-shape opacity-30" />
      <div className="absolute bottom-20 right-[15%] w-36 h-36 blob-yellow organic-shape opacity-35" />
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-16 pb-12 relative z-10">
        {/* Header with logo/title */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-primary">PetPals</span>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full">Academy</Button>
            <Button variant="ghost" size="sm" className="rounded-full">About Us</Button>
            <Button variant="ghost" size="sm" className="rounded-full">Program</Button>
            <Button variant="ghost" size="sm" className="rounded-full">Contacts</Button>
          </nav>
        </div>

        <div className="text-center mb-16">
          {/* Main heading with mixed typography */}
          <div className="relative inline-block">
            <div className="absolute -top-8 -left-8 w-20 h-20 blob-green opacity-40 rounded-full" />
            <h1 className="text-6xl md:text-7xl font-bold mb-4 relative">
              <span className="block">Creative</span>
              <span className="block italic font-serif text-primary">Kids Routine</span>
            </h1>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 blob-purple opacity-40 rounded-full" />
          </div>
          
          {/* Description with decorative badge */}
          <div className="max-w-2xl mx-auto mt-12 relative">
            <div className="absolute -top-4 left-0 w-28 h-28 rounded-full border-4 border-purple-200 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=200&h=200&fit=crop" 
                alt="Happy child"
                className="w-full h-full object-cover"
              />
            </div>
            <Card className="bg-white/80 backdrop-blur p-6 rounded-3xl shadow-lg">
              <p className="text-lg text-muted-foreground leading-relaxed">
                PetPals provides a nurturing environment where young minds can flourish and explore their daily routines with virtual companions.
              </p>
            </Card>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
          {/* Large feature card */}
          <Card className="md:col-span-1 p-8 rounded-3xl bg-gradient-playful-green border-0 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
            <div className="absolute top-4 right-4 w-12 h-12 bg-white/30 rounded-full" />
            <div className="absolute bottom-4 left-4 w-16 h-16 blob-yellow opacity-40" />
            <div className="text-sm font-medium text-green-900 mb-2">5-8 years</div>
            <h3 className="text-2xl font-bold mb-2">Creative</h3>
            <p className="text-3xl font-serif italic text-green-900">Scheduling</p>
            <div className="mt-6 w-16 h-16 bg-yellow-200 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-800" />
            </div>
          </Card>

          {/* Medium feature card */}
          <Card className="md:col-span-1 p-8 rounded-3xl bg-gradient-playful-purple border-0 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/20 rounded-full" />
            <div className="text-sm font-medium text-purple-900 mb-2">4-6 years</div>
            <h3 className="text-2xl font-bold mb-2">Creative</h3>
            <p className="text-3xl font-serif italic text-purple-900">Virtual Pets</p>
            <div className="mt-4 relative w-24 h-24">
              <PetAvatar petType="panda" happiness={85} size="md" />
            </div>
          </Card>

          {/* Another feature card */}
          <Card className="md:col-span-1 p-8 rounded-3xl bg-gradient-playful-yellow border-0 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
            <div className="absolute bottom-4 right-4 w-14 h-14 bg-white/30 rounded-full" />
            <div className="text-sm font-medium text-yellow-900 mb-2">6 years+</div>
            <h3 className="text-2xl font-bold mb-2">Creative</h3>
            <p className="text-3xl font-serif italic text-yellow-900">Rewards</p>
            <div className="mt-6 flex gap-2">
              <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-green-800" />
              </div>
              <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                <Heart className="w-6 h-6 text-purple-800" />
              </div>
            </div>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="max-w-4xl mx-auto p-12 rounded-3xl bg-gradient-playful-purple border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="block">Start now</span>
              <span className="block italic font-serif text-purple-900">Learning</span>
            </h2>
            <p className="text-lg text-purple-900 mb-8 max-w-xl mx-auto">
              Begin your child's education in this children's routine app now to lay a strong foundation for your future.
            </p>
            
            {/* Decorative image circle */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=300&h=300&fit=crop" 
                    alt="Happy learning"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -right-4 -top-4 w-20 h-20 blob-green opacity-60" />
              </div>
            </div>

            <Button 
              size="lg"
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-6 rounded-full text-lg font-semibold"
              onClick={() => navigate("/")}
            >
              Get started →
            </Button>
          </div>
        </Card>

        {/* Why Choose Section */}
        <div className="max-w-4xl mx-auto mt-20">
          <h2 className="text-4xl font-bold text-center mb-4">
            Why choose <span className="italic font-serif text-primary">PetPals?</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Our students are chosen to study in our children's app because of the high quality of education
          </p>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 blob-purple flex items-center justify-center">
                <Star className="w-8 h-8 text-purple-700" />
              </div>
              <h3 className="font-bold text-lg mb-2">Full Development</h3>
              <p className="text-sm text-muted-foreground">
                We believe that learning should contribute to the full development of each child
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 blob-green flex items-center justify-center">
                <Heart className="w-8 h-8 text-green-700" />
              </div>
              <h3 className="font-bold text-lg mb-2">Personal Touch</h3>
              <p className="text-sm text-muted-foreground">
                We understand that every child is unique and has their own needs and talents
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 blob-yellow flex items-center justify-center">
                <Users className="w-8 h-8 text-yellow-700" />
              </div>
              <h3 className="font-bold text-lg mb-2">Love Children</h3>
              <p className="text-sm text-muted-foreground">
                Our teachers and staff are always ready to give children warmth
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
