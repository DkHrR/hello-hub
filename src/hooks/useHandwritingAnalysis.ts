import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import type { HandwritingMetrics } from '@/types/diagnostic';
import { 
  getTesseractLanguage, 
  detectCharacterConfusions,
  type SupportedLanguage 
} from '@/data/phoneticPatterns';
import logger from '@/lib/logger';

interface CharacterAnalysis {
  reversals: { char: string; position: number; context: string; description: string }[];
  crowdingScore: number;
  inconsistencyScore: number;
  lineAdherence: number;
}

interface UseHandwritingAnalysisOptions {
  language?: SupportedLanguage;
}

export function useHandwritingAnalysis(options: UseHandwritingAnalysisOptions = {}) {
  const { language: initialLanguage = 'en' } = options;
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [characterAnalysis, setCharacterAnalysis] = useState<CharacterAnalysis | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(initialLanguage);

  // Set language dynamically
  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setCurrentLanguage(lang);
  }, []);

  const analyzeImage = useCallback(async (
    imageSource: string | File, 
    language?: SupportedLanguage
  ): Promise<HandwritingMetrics> => {
    setIsAnalyzing(true);
    setProgress(0);

    const analysisLanguage = language || currentLanguage;
    const tesseractLang = getTesseractLanguage(analysisLanguage);

    try {
      const result = await Tesseract.recognize(imageSource, tesseractLang, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });

      const text = result.data.text;
      setRecognizedText(text);

      // Analyze for character reversals using language-specific patterns
      const confusions = detectCharacterConfusions(text, analysisLanguage);
      const reversals: CharacterAnalysis['reversals'] = confusions.map(c => ({
        char: c.char,
        position: c.position,
        context: c.context,
        description: c.description
      }));
      
      // Also detect English-style b/d reversals if using Latin script
      if (analysisLanguage === 'en') {
        const bdReversals = detectEnglishReversals(text);
        reversals.push(...bdReversals);
      }
      
      // Analyze using confidence from result
      const crowdingScore = analyzeTextCrowding(text);
      const inconsistencyScore = Math.max(0, 1 - (result.data.confidence / 100));
      const lineAdherence = analyzeLineAdherenceFromText(text);

      const analysis: CharacterAnalysis = {
        reversals,
        crowdingScore,
        inconsistencyScore,
        lineAdherence
      };
      setCharacterAnalysis(analysis);

      const metrics: HandwritingMetrics = {
        reversalCount: reversals.length,
        letterCrowding: crowdingScore,
        graphicInconsistency: inconsistencyScore,
        lineAdherence
      };

      setIsAnalyzing(false);
      return metrics;
    } catch (error) {
      logger.error('Handwriting analysis failed', error);
      setIsAnalyzing(false);
      throw error;
    }
  }, [currentLanguage]);

  const detectEnglishReversals = (text: string): CharacterAnalysis['reversals'] => {
    const reversals: CharacterAnalysis['reversals'] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    const bdPatterns = [
      { pattern: /doy/, expected: 'boy' },
      { pattern: /dag/, expected: 'bag' },
      { pattern: /ded/, expected: 'bed' },
      { pattern: /dig/, expected: 'big' },
      { pattern: /bown/, expected: 'down' },
    ];
    
    words.forEach((word, wordIndex) => {
      bdPatterns.forEach(({ pattern, expected }) => {
        if (pattern.test(word)) {
          reversals.push({
            char: 'b↔d',
            position: wordIndex,
            context: `"${word}" (expected: "${expected}")`,
            description: 'b/d reversal'
          });
        }
      });
    });
    
    return reversals;
  };

  const analyzeTextCrowding = (text: string): number => {
    // Estimate crowding based on word spacing patterns
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 2) return 0;
    
    let crowdingIndicators = 0;
    words.forEach(word => {
      // Long words without spaces might indicate crowding
      if (word.length > 15) crowdingIndicators++;
    });
    
    return Math.min(crowdingIndicators / words.length, 1);
  };

  const analyzeLineAdherenceFromText = (text: string): number => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return 1;
    
    // More consistent line lengths = better adherence
    const lengths = lines.map(l => l.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
    const cv = avgLength > 0 ? Math.sqrt(variance) / avgLength : 0;
    
    return Math.max(0, 1 - cv);
  };

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setProgress(0);
    setRecognizedText('');
    setCharacterAnalysis(null);
  }, []);

  return {
    isAnalyzing,
    progress,
    recognizedText,
    characterAnalysis,
    currentLanguage,
    analyzeImage,
    setLanguage,
    reset
  };
}
