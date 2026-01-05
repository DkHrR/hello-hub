import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Chrome, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BrowserCompatibilityAlertProps {
  feature: 'speech' | 'camera' | 'general';
}

export function BrowserCompatibilityAlert({ feature }: BrowserCompatibilityAlertProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{
    isChrome: boolean;
    isFirefox: boolean;
    isSafari: boolean;
    isEdge: boolean;
    isMobile: boolean;
  }>({
    isChrome: false,
    isFirefox: false,
    isSafari: false,
    isEdge: false,
    isMobile: false
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    const info = {
      isChrome: /Chrome/.test(ua) && !/Edge|Edg/.test(ua),
      isFirefox: /Firefox/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
      isEdge: /Edge|Edg/.test(ua),
      isMobile: /Mobile|Android|iPhone|iPad/.test(ua)
    };
    setBrowserInfo(info);

    // Check compatibility
    if (feature === 'speech') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsVisible(true);
      }
    }

    if (feature === 'camera') {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIsVisible(true);
      }
    }
  }, [feature]);

  if (!isVisible) return null;

  const getMessage = () => {
    if (feature === 'speech') {
      if (browserInfo.isFirefox) {
        return {
          title: 'Speech Recognition Not Supported',
          description: 'Firefox does not support the Web Speech API. For the best experience with voice assessment, please use Chrome or Edge.',
          suggestion: 'The voice analysis feature will be limited. You can still complete the assessment, but voice metrics won\'t be recorded.'
        };
      }
      if (browserInfo.isSafari && browserInfo.isMobile) {
        return {
          title: 'Limited Speech Support',
          description: 'iOS Safari has limited speech recognition support. For the best experience, please use Chrome on a desktop computer.',
          suggestion: 'Voice assessment may not work correctly on this device.'
        };
      }
    }

    return {
      title: 'Browser Compatibility Issue',
      description: 'Some features may not work correctly in your browser.',
      suggestion: 'For the best experience, we recommend using Google Chrome.'
    };
  };

  const message = getMessage();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-6"
      >
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            {message.title}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p>{message.description}</p>
            <p className="mt-2 text-sm opacity-80">{message.suggestion}</p>
            
            <div className="flex items-center gap-4 mt-4">
              <a
                href="https://www.google.com/chrome/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm underline hover:no-underline"
              >
                <Chrome className="w-4 h-4" />
                Download Chrome
              </a>
              <a
                href="https://www.microsoft.com/edge"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm underline hover:no-underline"
              >
                <Globe className="w-4 h-4" />
                Download Edge
              </a>
            </div>
          </AlertDescription>
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}
