import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MobileHeader } from './MobileHeader';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  fullScreen?: boolean;
  className?: string;
}

export function MobileLayout({ 
  children, 
  showNav = true, 
  fullScreen = false,
  className 
}: MobileLayoutProps) {
  return (
    <div className={cn(
      'min-h-screen bg-background',
      fullScreen ? '' : 'pb-20', // Space for bottom nav
      className
    )}>
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          fullScreen ? 'h-screen' : 'min-h-screen'
        )}
      >
        {children}
      </motion.main>
      {showNav && <MobileHeader />}
    </div>
  );
}

// Swipeable section component for mobile
interface MobileSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function MobileSection({ children, className, id }: MobileSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'px-4 py-6',
        className
      )}
    >
      {children}
    </section>
  );
}

// Mobile card with touch-friendly styling
interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MobileCard({ children, className, onClick }: MobileCardProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl p-4 border border-border shadow-sm',
        onClick && 'cursor-pointer active:bg-muted/50',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Pull to refresh indicator
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  // Simplified implementation - full implementation would use touch events
  return (
    <div className="relative">
      {children}
    </div>
  );
}
