import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

interface BalloonCalibrationProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface CalibrationPoint {
  id: number;
  x: number;
  y: number;
  completed: boolean;
}

// 9-point calibration grid
const CALIBRATION_POSITIONS = [
  { x: 10, y: 10 },   // Top-left
  { x: 50, y: 10 },   // Top-center
  { x: 90, y: 10 },   // Top-right
  { x: 10, y: 50 },   // Middle-left
  { x: 50, y: 50 },   // Center
  { x: 90, y: 50 },   // Middle-right
  { x: 10, y: 90 },   // Bottom-left
  { x: 50, y: 90 },   // Bottom-center
  { x: 90, y: 90 },   // Bottom-right
];

const BALLOON_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--info))',
  'hsl(var(--destructive))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
];

export function BalloonCalibration({ onComplete, onSkip }: BalloonCalibrationProps) {
  const [currentPoint, setCurrentPoint] = useState(0);
  const [points, setPoints] = useState<CalibrationPoint[]>(
    CALIBRATION_POSITIONS.map((pos, i) => ({
      id: i,
      x: pos.x,
      y: pos.y,
      completed: false
    }))
  );
  const [showInstructions, setShowInstructions] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const progress = (points.filter(p => p.completed).length / points.length) * 100;

  const handleBalloonClick = useCallback((pointId: number) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // Mark point as completed
    setPoints(prev => 
      prev.map(p => p.id === pointId ? { ...p, completed: true } : p)
    );

    // Play pop sound (optional - add audio feedback)
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleB0DV6mxoGchDBKMw8+vc0ILOZrRxI5LDBtPruPYnloVCEilspVNFAougt/QkV4sFGe60dSHQhI5meLabE0HEUyp');
    audio.volume = 0.3;
    audio.play().catch(() => {});

    // Move to next point after animation
    setTimeout(() => {
      const nextIncomplete = points.findIndex((p, i) => i > pointId && !p.completed);
      if (nextIncomplete !== -1) {
        setCurrentPoint(nextIncomplete);
      } else if (points.filter(p => p.completed).length + 1 >= points.length) {
        // All points completed
        setTimeout(onComplete, 500);
      }
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, points, onComplete]);

  useEffect(() => {
    if (showInstructions) {
      const timer = setTimeout(() => setShowInstructions(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showInstructions]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-hero flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Eye Calibration</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Progress value={progress} />
          </div>
          <span className="text-sm text-muted-foreground">
            {points.filter(p => p.completed).length}/{points.length}
          </span>
        </div>
      </div>

      {/* Instructions overlay */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-background/90 flex items-center justify-center"
          >
            <div className="text-center max-w-md p-8">
              <div className="w-20 h-20 rounded-full bg-gradient-neuro flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Pop the Balloons!</h3>
              <p className="text-muted-foreground mb-6">
                Click or tap each balloon while looking directly at it. 
                This helps calibrate the eye tracker for accurate readings.
              </p>
              <div className="flex gap-2 justify-center">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-8 h-10 rounded-full bg-gradient-neuro"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ 
                      duration: 1, 
                      delay: i * 0.2, 
                      repeat: Infinity 
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balloons */}
      <div className="flex-1 relative">
        {points.map((point, index) => (
          <AnimatePresence key={point.id}>
            {!point.completed && (
              <motion.button
                initial={{ scale: 0, y: 50 }}
                animate={{ 
                  scale: currentPoint === index ? [1, 1.1, 1] : 1,
                  y: 0
                }}
                exit={{ 
                  scale: [1.2, 0],
                  opacity: 0,
                  transition: { duration: 0.3 }
                }}
                transition={{
                  scale: {
                    duration: 0.8,
                    repeat: currentPoint === index ? Infinity : 0,
                    repeatType: 'reverse'
                  },
                  y: { type: 'spring', stiffness: 300, damping: 20 }
                }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`
                }}
                onClick={() => handleBalloonClick(point.id)}
                disabled={isAnimating}
              >
                {/* Balloon */}
                <div 
                  className="relative"
                  style={{ 
                    filter: currentPoint === index ? 'drop-shadow(0 0 20px currentColor)' : 'none'
                  }}
                >
                  <svg 
                    width="60" 
                    height="80" 
                    viewBox="0 0 60 80"
                    className="transition-transform hover:scale-110"
                  >
                    {/* Balloon body */}
                    <ellipse
                      cx="30"
                      cy="30"
                      rx="25"
                      ry="30"
                      fill={BALLOON_COLORS[index]}
                      className="transition-all"
                    />
                    {/* Shine */}
                    <ellipse
                      cx="22"
                      cy="20"
                      rx="8"
                      ry="10"
                      fill="white"
                      opacity="0.3"
                    />
                    {/* Knot */}
                    <polygon
                      points="27,58 33,58 30,65"
                      fill={BALLOON_COLORS[index]}
                    />
                    {/* String */}
                    <path
                      d="M30,65 Q28,72 30,78"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth="1"
                      fill="none"
                    />
                  </svg>
                  
                  {/* Point number */}
                  <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg" style={{ marginTop: '-10px' }}>
                    {index + 1}
                  </span>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        ))}
      </div>

    </motion.div>
  );
}