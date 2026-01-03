import { Zap, Shield, BarChart3, Sparkles, Globe, Layers } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built for speed. Our infrastructure ensures your app loads in milliseconds, not seconds.",
    gradient: "from-primary to-secondary",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-grade encryption and compliance. Your data is protected with industry-leading security.",
    gradient: "from-secondary to-accent",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Get instant insights with beautiful dashboards. Make data-driven decisions effortlessly.",
    gradient: "from-accent to-primary",
  },
  {
    icon: Sparkles,
    title: "AI-Powered",
    description: "Smart automation that learns from your workflow. Let AI handle the repetitive tasks.",
    gradient: "from-primary to-accent",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Deploy worldwide with one click. Edge computing brings your app closer to users.",
    gradient: "from-secondary to-primary",
  },
  {
    icon: Layers,
    title: "Seamless Integration",
    description: "Connect with 100+ tools you already use. No complex setup required.",
    gradient: "from-accent to-secondary",
  },
];

const Features = () => {
  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Everything you need to{" "}
            <span className="gradient-text">succeed</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to help you work smarter, move faster, and scale effortlessly.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Icon */}
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-6 glow-sm`}>
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Hover decoration */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;