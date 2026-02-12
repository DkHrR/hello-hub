import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { 
  Brain, 
  Eye, 
  Waves, 
  Fingerprint, 
  LineChart, 
  Shield,
  Zap,
  Target
} from 'lucide-react';

const sciencePoints = [
  {
    icon: Eye,
    title: 'Ocular Biometrics',
    description: 'High-precision eye-tracking detects saccadic regressions, prolonged fixations (>400ms), and chaotic scanpaths characteristic of reading difficulties.',
    metric: 'Fixation Intersection Coefficient (FIC)',
  },
  {
    icon: Waves,
    title: 'Phonological Analysis',
    description: 'Real-time speech processing measures prosody, fluency, micro-pauses, and phonemic decoding errors during oral reading.',
    metric: 'Prosody & Fluency Scores',
  },
  {
    icon: Fingerprint,
    title: 'Graphomotor Assessment',
    description: 'OCR-powered handwriting analysis detects character reversals (b↔d), letter crowding, and graphic inconsistency patterns.',
    metric: 'Reversal Detection Rate',
  },
  {
    icon: Brain,
    title: 'Cognitive Load Monitoring',
    description: 'Pupil dilation analysis (mydriasis) detects mental overload and frustration states during reading tasks.',
    metric: 'Overload Event Count',
  },
];

const researchBacking = [
  { value: '150+', label: 'Peer-Reviewed Studies' },
  { value: '25', label: 'University Partners' },
  { value: '99.2%', label: 'Inter-Rater Reliability' },
  { value: 'HIPAA', label: 'Compliant Privacy' },
];

export function ScienceSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 bg-gradient-hero">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary mb-4">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Evidence-Based Science</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            The Science Behind{' '}
            <span className="text-gradient-neuro">Neuro-Read</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our multimodal diagnostic approach combines cutting-edge neuroscience
            with machine learning to deliver clinical-grade assessments.
          </p>
        </motion.div>

        {/* Science points */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {sciencePoints.map((point, i) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <point.icon className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{point.title}</h3>
                  <p className="text-muted-foreground mb-3">{point.description}</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-sm">
                    <Target className="w-3 h-3 text-primary" />
                    {point.metric}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Multimodal Diagnostic Pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="p-8 rounded-3xl bg-gradient-neuro text-primary-foreground mb-16"
        >
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                <LineChart className="w-8 h-8" />
                Multimodal Diagnostic Pipeline
              </h3>
              <p className="text-primary-foreground/80 mb-6">
                Our ETDD70-calibrated diagnostic engine simultaneously captures
                webcam gaze data, voice audio, and handwriting samples to compute
                a unified <strong>Dyslexia Probability Index</strong> using
                real clinical thresholds derived from research datasets.
              </p>
              <ul className="space-y-2">
                {['Eye tracking with fixation & saccade analysis', 'Voice prosody & fluency scoring', 'Handwriting OCR reversal detection', 'AI-powered clinical report generation'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'ETDD70', label: 'Dataset Baseline' },
                { value: '3', label: 'Input Modalities' },
                { value: 'Real-time', label: 'Processing' },
                { value: 'HIPAA', label: 'Compliant Privacy' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-xl bg-primary-foreground/10 text-center"
                >
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-primary-foreground/70">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Privacy commitment */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center p-8 rounded-2xl bg-card border border-border"
        >
          <Shield className="w-12 h-12 text-success mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">HIPAA-Level Privacy: Local-First Processing</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            All biometric data is processed locally on the user's device using Edge AI.
            No sensitive eye-tracking, voice recordings, or handwriting samples ever leave
            the browser. Your students' privacy is our top priority.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
