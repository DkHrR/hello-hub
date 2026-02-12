import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Brain, Eye, Mic, PenTool, ArrowRight, Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import heroImage from '@/assets/hero-neural.jpg';
import { useAuth } from '@/contexts/AuthContext';

export function HeroSection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartAssessment = () => {
    if (user) {
      navigate('/assessment');
    } else {
      navigate('/auth');
    }
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Neural network visualization"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/30"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            transition={{
              duration: Math.random() * 20 + 10,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        ))}
      </div>

      <div className="container relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6"
            >
              <Brain className="w-4 h-4" />
              <span className="text-sm font-medium">AI-Powered Diagnostics</span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="text-gradient-neuro">Neuro-Read</span>
              <br />
              <span className="text-foreground">X Platinum</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-xl">
              The world's most comprehensive AI diagnostic ecosystem for{' '}
              <span className="text-primary font-semibold">Dyslexia</span>,{' '}
              <span className="text-secondary font-semibold">ADHD</span>, and{' '}
              <span className="text-accent font-semibold">Dysgraphia</span>.
              Multimodal analysis. Clinical-grade insights.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Button variant="hero" size="xl" onClick={handleStartAssessment}>
                Start Assessment
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Link to="/demo">
                <Button variant="neuro" size="xl">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6">
              {[
                { value: '10-15%', label: 'Global Prevalence' },
                { value: '3', label: 'Input Modalities' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="text-center lg:text-left"
                >
                  <div className="text-2xl md:text-3xl font-bold text-gradient-neuro">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right content - Feature cards */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              {
                icon: Eye,
                title: 'Eye Tracking',
                description: 'Saccadic regression & fixation analysis',
                color: 'primary',
              },
              {
                icon: Mic,
                title: 'Voice Analysis',
                description: 'Phonological & prosody assessment',
                color: 'secondary',
              },
              {
                icon: PenTool,
                title: 'Handwriting OCR',
                description: 'Character reversal detection',
                color: 'accent',
              },
              {
                icon: Brain,
                title: 'Neural Engine',
                description: 'ML-powered risk indexing',
                color: 'primary',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-${feature.color}/10 flex items-center justify-center mb-4`}
                  style={{
                    backgroundColor: `hsl(var(--${feature.color}) / 0.1)`,
                  }}
                >
                  <feature.icon
                    className="w-6 h-6"
                    style={{ color: `hsl(var(--${feature.color}))` }}
                  />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}
