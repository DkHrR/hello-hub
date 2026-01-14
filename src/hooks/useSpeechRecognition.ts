import { useState, useCallback, useRef, useEffect } from 'react';
import type { VoiceMetrics } from '@/types/diagnostic';
import { 
  getSpeechLocale, 
  getHesitationPattern, 
  calculateLanguageAwareFluency,
  type SupportedLanguage 
} from '@/data/phoneticPatterns';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface StallEvent {
  startTime: number;
  endTime: number;
  duration: number;
  wordBefore: string;
  wordAfter: string;
}

interface UseSpeechRecognitionOptions {
  language?: SupportedLanguage;
  grade?: string;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { language = 'en', grade = 'default' } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [wordTimings, setWordTimings] = useState<{ word: string; timestamp: number }[]>([]);
  const [pauseEvents, setPauseEvents] = useState<{ start: number; end: number }[]>([]);
  const [stallEvents, setStallEvents] = useState<StallEvent[]>([]);
  const [currentStallDuration, setCurrentStallDuration] = useState(0);
  const [isStalling, setIsStalling] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(language);
  const [currentGrade, setCurrentGrade] = useState(grade);
  
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const lastWordTimeRef = useRef<number>(0);
  const lastWordRef = useRef<string>('');
  const pauseStartRef = useRef<number | null>(null);
  const stallCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stallStartRef = useRef<number | null>(null);
  
  const PAUSE_THRESHOLD = 500; // ms - detect pauses longer than this
  const STALL_THRESHOLD = 1500; // ms - detect stalls (hesitation) longer than 1.5s

  // Set language dynamically
  const setLanguage = useCallback((lang: SupportedLanguage, studentGrade?: string) => {
    setCurrentLanguage(lang);
    if (studentGrade) {
      setCurrentGrade(studentGrade);
    }
    // Update recognition language if already initialized
    if (recognitionRef.current) {
      recognitionRef.current.lang = getSpeechLocale(lang);
    }
  }, []);

  const initialize = useCallback((locale?: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // Speech recognition not supported in this browser
      return false;
    }
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    
    // Use provided locale, or derive from currentLanguage
    recognitionRef.current.lang = locale || getSpeechLocale(currentLanguage);
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      const currentTime = Date.now() - startTimeRef.current;
      
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
          
          // Record word timings
          const words = result[0].transcript.trim().split(/\s+/);
          words.forEach(word => {
            if (word) {
              // Check for pause before this word
              if (lastWordTimeRef.current > 0) {
                const gap = currentTime - lastWordTimeRef.current;
                if (gap > PAUSE_THRESHOLD) {
                  setPauseEvents(prev => [...prev, {
                    start: lastWordTimeRef.current,
                    end: currentTime
                  }]);
                }
                
                // Check for stall (>1.5s gap) and record it
                if (gap >= 1500 && stallStartRef.current) {
                  setStallEvents(prev => [...prev, {
                    startTime: stallStartRef.current!,
                    endTime: currentTime,
                    duration: gap,
                    wordBefore: lastWordRef.current,
                    wordAfter: word
                  }]);
                  stallStartRef.current = null;
                  setIsStalling(false);
                  setCurrentStallDuration(0);
                }
              }
              
              setWordTimings(prev => [...prev, { word, timestamp: currentTime }]);
              lastWordTimeRef.current = currentTime;
              lastWordRef.current = word;
            }
          });
        } else {
          interim += result[0].transcript;
        }
      }
      
      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };
    
    recognitionRef.current.onerror = (event: any) => {
      // Handle speech recognition errors - 'no-speech' is expected when user is silent
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };
    
    recognitionRef.current.onend = () => {
      if (isListening) {
        // Restart if still supposed to be listening
        try {
          recognitionRef.current?.start();
        } catch {
          // Failed to restart - recognition will stop
        }
      }
    };
    
    return true;
  }, [isListening, currentLanguage]);

  // Stall detection interval - checks every 100ms if user is stalling
  const startStallDetection = useCallback(() => {
    if (stallCheckIntervalRef.current) {
      clearInterval(stallCheckIntervalRef.current);
    }
    
    stallCheckIntervalRef.current = setInterval(() => {
      if (lastWordTimeRef.current > 0) {
        const currentTime = Date.now() - startTimeRef.current;
        const timeSinceLastWord = currentTime - lastWordTimeRef.current;
        
        if (timeSinceLastWord >= STALL_THRESHOLD) {
          if (!stallStartRef.current) {
            stallStartRef.current = lastWordTimeRef.current;
          }
          setIsStalling(true);
          setCurrentStallDuration(timeSinceLastWord);
        }
      }
    }, 100);
  }, []);

  const stopStallDetection = useCallback(() => {
    if (stallCheckIntervalRef.current) {
      clearInterval(stallCheckIntervalRef.current);
      stallCheckIntervalRef.current = null;
    }
    setIsStalling(false);
    setCurrentStallDuration(0);
  }, []);

  // Record stall event when word is finally spoken after stalling
  const recordStallEvent = useCallback((newWord: string) => {
    if (stallStartRef.current !== null) {
      const currentTime = Date.now() - startTimeRef.current;
      const duration = currentTime - stallStartRef.current;
      
      if (duration >= STALL_THRESHOLD) {
        setStallEvents(prev => [...prev, {
          startTime: stallStartRef.current!,
          endTime: currentTime,
          duration,
          wordBefore: lastWordRef.current,
          wordAfter: newWord
        }]);
      }
      
      stallStartRef.current = null;
      setIsStalling(false);
      setCurrentStallDuration(0);
    }
  }, []);

  const start = useCallback((locale?: string) => {
    if (!recognitionRef.current) {
      if (!initialize(locale)) return;
    } else if (locale) {
      // Update locale if provided
      recognitionRef.current.lang = locale;
    }
    
    try {
      startTimeRef.current = Date.now();
      lastWordTimeRef.current = 0;
      lastWordRef.current = '';
      stallStartRef.current = null;
      recognitionRef.current?.start();
      setIsListening(true);
      startStallDetection();
    } catch {
      // Failed to start recognition - may already be running
    }
  }, [initialize, startStallDetection]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    stopStallDetection();
  }, [stopStallDetection]);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setWordTimings([]);
    setPauseEvents([]);
    setStallEvents([]);
    setCurrentStallDuration(0);
    setIsStalling(false);
    lastWordTimeRef.current = 0;
    lastWordRef.current = '';
    pauseStartRef.current = null;
    stallStartRef.current = null;
  }, []);

  const getMetrics = useCallback((): VoiceMetrics => {
    const totalTime = wordTimings.length > 0 
      ? (wordTimings[wordTimings.length - 1].timestamp - wordTimings[0].timestamp) / 1000 / 60
      : 0;
    
    const wordsPerMinute = totalTime > 0 ? wordTimings.length / totalTime : 0;
    
    const avgPauseDuration = pauseEvents.length > 0
      ? pauseEvents.reduce((sum, p) => sum + (p.end - p.start), 0) / pauseEvents.length
      : 0;
    
    // Detect phonemic errors using language-specific patterns
    const errorPattern = getHesitationPattern(currentLanguage);
    const phonemicErrors = (transcript.match(errorPattern) || []).length;
    
    // Calculate fluency score using language-aware algorithm
    const fluencyScore = calculateLanguageAwareFluency(
      Math.round(wordsPerMinute),
      pauseEvents.length,
      phonemicErrors,
      currentLanguage,
      currentGrade
    );
    
    // Prosody score (simplified - based on timing variance)
    let prosodyScore = 70;
    if (wordTimings.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < wordTimings.length; i++) {
        intervals.push(wordTimings[i].timestamp - wordTimings[i-1].timestamp);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / avgInterval;
      prosodyScore = Math.max(0, Math.min(100, 100 - cv * 100));
    }
    
    // Calculate stalling metrics
    const stallCount = stallEvents.length;
    const avgStallDuration = stallEvents.length > 0
      ? stallEvents.reduce((sum, s) => sum + s.duration, 0) / stallEvents.length
      : 0;
    
    // Adjust fluency score based on stalls (stalls are more severe than pauses)
    const stallPenalty = Math.min(stallEvents.length * 15, 40);
    const adjustedFluencyScore = Math.max(0, fluencyScore - stallPenalty);
    
    return {
      wordsPerMinute: Math.round(wordsPerMinute),
      pauseCount: pauseEvents.length,
      averagePauseDuration: Math.round(avgPauseDuration),
      phonemicErrors,
      fluencyScore: Math.round(adjustedFluencyScore),
      prosodyScore: Math.round(prosodyScore),
      stallCount,
      averageStallDuration: Math.round(avgStallDuration),
      stallEvents
    };
  }, [transcript, wordTimings, pauseEvents, stallEvents, currentLanguage, currentGrade]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopStallDetection();
    };
  }, [stopStallDetection]);

  return {
    isListening,
    transcript,
    interimTranscript,
    wordTimings,
    pauseEvents,
    stallEvents,
    isStalling,
    currentStallDuration,
    currentLanguage,
    start,
    stop,
    reset,
    getMetrics,
    setLanguage
  };
}
