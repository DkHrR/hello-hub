import { useState, useEffect, useRef } from 'react';
import { motion, useSpring } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Eye, TrendingUp } from 'lucide-react';

interface LiveCounterProps {
  className?: string;
}

export function LiveCounter({ className = '' }: LiveCounterProps) {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const previousCount = useRef(0);
  
  const springValue = useSpring(0, { stiffness: 50, damping: 20 });
  const [displayCount, setDisplayCount] = useState('0');

  useEffect(() => {
    const fetchCount = async () => {
      try {
        // Query assessment_results table (the actual table in the schema)
        const { count: totalCount, error } = await supabase
          .from('assessment_results')
          .select('*', { count: 'exact', head: true });
        
        if (!error && totalCount !== null) {
          setCount(totalCount);
          previousCount.current = totalCount;
        }
      } catch {
        // Silently handle count fetch errors - non-critical for user experience
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();

    // Subscribe to real-time updates on assessment_results
    const channel = supabase
      .channel('assessment-counter')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assessment_results'
        },
        () => {
          setCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    springValue.set(count);
  }, [count, springValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (value) => {
      setDisplayCount(Math.floor(value).toLocaleString('en-IN'));
    });
    return unsubscribe;
  }, [springValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 ${className}`}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            initial={{
              x: Math.random() * 100 + '%',
              y: Math.random() * 100 + '%',
            }}
            animate={{
              x: [
                Math.random() * 100 + '%',
                Math.random() * 100 + '%',
                Math.random() * 100 + '%'
              ],
              y: [
                Math.random() * 100 + '%',
                Math.random() * 100 + '%',
                Math.random() * 100 + '%'
              ],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className="w-14 h-14 rounded-xl bg-gradient-neuro flex items-center justify-center">
            <Eye className="w-7 h-7 text-primary-foreground" />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            {isLoading ? (
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
            ) : (
              <motion.span
                className="text-4xl md:text-5xl font-bold text-gradient-neuro tabular-nums"
                key={count}
              >
                {displayCount}
              </motion.span>
            )}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <TrendingUp className="w-5 h-5 text-success" />
            </motion.div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-1">
            Students Scanned in India
          </p>
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Live</span>
      </div>
    </motion.div>
  );
}