import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Smartphone, 
  Monitor, 
  Check, 
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  Share
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  React.useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: WifiOff,
      title: 'Work Offline',
      description: 'Conduct assessments without internet. Data syncs automatically when you reconnect.',
    },
    {
      icon: Smartphone,
      title: 'Native App Experience',
      description: 'Launch from your home screen like any other app. No browser required.',
    },
    {
      icon: RefreshCw,
      title: 'Auto-Sync',
      description: 'Assessment results sync seamlessly in the background when online.',
    },
    {
      icon: Monitor,
      title: 'Cross-Platform',
      description: 'Works on any device - phones, tablets, and desktop computers.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Hero Section */}
          <div className="text-center mb-12">
            <Badge className="mb-4" variant="secondary">
              Progressive Web App
            </Badge>
            <h1 className="text-4xl font-bold mb-4">
              Install NeuroRead
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get the full app experience with offline support, faster loading, 
              and easy access from your home screen.
            </p>
          </div>

          {/* Install Status */}
          {isInstalled ? (
            <Card className="mb-8 border-green-500/50 bg-green-500/10">
              <CardContent className="flex items-center justify-center gap-3 py-6">
                <Check className="h-6 w-6 text-green-500" />
                <span className="text-lg font-medium text-green-600 dark:text-green-400">
                  NeuroRead is already installed on your device!
                </span>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-8">
              <CardHeader className="text-center">
                <CardTitle>Ready to Install</CardTitle>
                <CardDescription>
                  {isIOS
                    ? 'Follow the steps below to add NeuroRead to your home screen'
                    : 'Click the button below to install NeuroRead'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {isIOS ? (
                  <div className="space-y-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        1
                      </span>
                      <span>Tap the Share button</span>
                      <Share className="h-5 w-5" />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        2
                      </span>
                      <span>Scroll down and tap "Add to Home Screen"</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        3
                      </span>
                      <span>Tap "Add" to confirm</span>
                    </div>
                  </div>
                ) : deferredPrompt ? (
                  <Button size="lg" onClick={handleInstall} className="gap-2">
                    <Download className="h-5 w-5" />
                    Install NeuroRead
                  </Button>
                ) : (
                  <p className="text-muted-foreground">
                    Your browser will prompt you to install when ready, or use your browser's menu to add to home screen.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardContent className="flex items-start gap-4 pt-6">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Offline Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Offline Capabilities
              </CardTitle>
              <CardDescription>
                What you can do without an internet connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {[
                  { available: true, text: 'Conduct full student assessments' },
                  { available: true, text: 'Eye tracking and gaze analysis' },
                  { available: true, text: 'Voice recording and transcription' },
                  { available: true, text: 'View cached student profiles' },
                  { available: true, text: 'Generate PDF reports locally' },
                  { available: false, text: 'AI-powered insights (requires connection)' },
                  { available: false, text: 'Real-time sync with team members' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    {item.available ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={item.available ? '' : 'text-muted-foreground'}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
