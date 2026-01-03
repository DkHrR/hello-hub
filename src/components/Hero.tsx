import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span className="text-sm font-medium text-foreground">Now in public beta — Try it free</span>
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
          <span className="block">Build faster.</span>
          <span className="gradient-text">Ship smarter.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          The all-in-one platform that supercharges your workflow. Automate the boring stuff 
          and focus on what matters — building amazing products your users will love.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Button size="lg" className="gradient-primary glow-sm text-lg px-8 py-6 rounded-xl font-semibold">
            Start for free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-xl font-semibold border-2">
            <Play className="mr-2 h-5 w-5" />
            Watch demo
          </Button>
        </div>

        {/* Social proof */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary border-2 border-background flex items-center justify-center text-primary-foreground text-xs font-bold"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">10,000+</span> teams already shipping faster
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;