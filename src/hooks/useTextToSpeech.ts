/**
 * Text-to-Speech Hook with Synchronized Word Highlighting
 * Web Speech API integration with adjustable speed and regional language support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';

export interface TTSConfig {
  rate: number; // 0.5 to 2
  pitch: number; // 0 to 2
  volume: number; // 0 to 1
  voiceURI?: string;
  language: string;
}

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentWordIndex: number;
  currentCharIndex: number;
  progress: number;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
}

const DEFAULT_CONFIG: TTSConfig = {
  rate: 1,
  pitch: 1,
  volume: 1,
  language: 'en-US',
};

const LANGUAGE_CODES: Record<string, string[]> = {
  english: ['en-US', 'en-GB', 'en-IN', 'en-AU'],
  hindi: ['hi-IN'],
  tamil: ['ta-IN'],
  telugu: ['te-IN'],
  kannada: ['kn-IN'],
  malayalam: ['ml-IN'],
  bengali: ['bn-IN'],
  marathi: ['mr-IN'],
};

export function useTextToSpeech(config: Partial<TTSConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    isPaused: false,
    currentWordIndex: -1,
    currentCharIndex: 0,
    progress: 0,
    voices: [],
    selectedVoice: null,
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textRef = useRef<string>('');
  const wordsRef = useRef<string[]>([]);
  const onWordChangeRef = useRef<((index: number) => void) | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setState(prev => ({ ...prev, voices }));
      
      // Auto-select best voice for language
      const langCode = cfg.language;
      const preferredVoice = voices.find(v => v.lang === langCode) ||
        voices.find(v => v.lang.startsWith(langCode.split('-')[0])) ||
        voices[0];
      
      if (preferredVoice) {
        setState(prev => ({ ...prev, selectedVoice: preferredVoice }));
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [cfg.language]);

  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setState(prev => ({ ...prev, selectedVoice: voice }));
  }, []);

  const setRate = useCallback((rate: number) => {
    if (utteranceRef.current) {
      utteranceRef.current.rate = Math.max(0.5, Math.min(2, rate));
    }
  }, []);

  const speak = useCallback((
    text: string,
    options?: {
      onWordChange?: (wordIndex: number) => void;
      onComplete?: () => void;
      startFromWord?: number;
    }
  ) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    textRef.current = text;
    wordsRef.current = text.split(/\s+/);
    onWordChangeRef.current = options?.onWordChange || null;
    onCompleteRef.current = options?.onComplete || null;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = cfg.rate;
    utterance.pitch = cfg.pitch;
    utterance.volume = cfg.volume;
    
    if (state.selectedVoice) {
      utterance.voice = state.selectedVoice;
      utterance.lang = state.selectedVoice.lang;
    }

    // Track word boundaries
    let currentCharPos = 0;
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Calculate word index from character index
        const charIndex = event.charIndex;
        let wordIndex = 0;
        let charCount = 0;
        
        for (let i = 0; i < wordsRef.current.length; i++) {
          const wordLength = wordsRef.current[i].length;
          if (charCount + wordLength >= charIndex) {
            wordIndex = i;
            break;
          }
          charCount += wordLength + 1; // +1 for space
        }

        setState(prev => ({
          ...prev,
          currentWordIndex: wordIndex,
          currentCharIndex: charIndex,
          progress: (charIndex / text.length) * 100,
        }));

        onWordChangeRef.current?.(wordIndex);
      }
    };

    utterance.onstart = () => {
      setState(prev => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        currentWordIndex: 0,
      }));
    };

    utterance.onend = () => {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        currentWordIndex: -1,
        progress: 100,
      }));
      onCompleteRef.current?.();
    };

    utterance.onerror = (event) => {
      logger.error('Text-to-speech error', event.error);
      setState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
      }));
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [cfg, state.selectedVoice]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      currentWordIndex: -1,
      progress: 0,
    }));
  }, []);

  const speakWord = useCallback((word: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = cfg.rate;
    utterance.pitch = cfg.pitch;
    utterance.volume = cfg.volume;
    if (state.selectedVoice) {
      utterance.voice = state.selectedVoice;
    }
    window.speechSynthesis.speak(utterance);
  }, [cfg, state.selectedVoice]);

  const getVoicesForLanguage = useCallback((language: string): SpeechSynthesisVoice[] => {
    const codes = LANGUAGE_CODES[language.toLowerCase()] || [language];
    return state.voices.filter(v => 
      codes.some(code => v.lang.startsWith(code.split('-')[0]))
    );
  }, [state.voices]);

  const previewVoice = useCallback((voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Hello, this is a preview of the selected voice.');
    utterance.voice = voice;
    utterance.rate = cfg.rate;
    window.speechSynthesis.speak(utterance);
  }, [cfg.rate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    ...state,
    speak,
    pause,
    resume,
    stop,
    speakWord,
    setVoice,
    setRate,
    getVoicesForLanguage,
    previewVoice,
    config: cfg,
  };
}
