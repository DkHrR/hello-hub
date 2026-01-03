import { useState, useEffect, useCallback } from 'react';

interface UIAdaptations {
  fontSize: number; // base font size multiplier (1 = normal)
  letterSpacing: number; // in em
  lineHeight: number; // line height multiplier
  wordSpacing: number; // in em
  contrast: 'normal' | 'high';
  dyslexicFont: boolean;
  reducedMotion: boolean;
  highlightCurrentLine: boolean;
}

interface RiskIndicators {
  eyeTrackingChaos: number; // 0-1
  fixationDuration: number; // avg ms
  regressionRate: number; // 0-1
  voiceFluency: number; // 0-100
  pauseFrequency: number; // pauses per minute
}

const DEFAULT_ADAPTATIONS: UIAdaptations = {
  fontSize: 1,
  letterSpacing: 0,
  lineHeight: 1.6,
  wordSpacing: 0,
  contrast: 'normal',
  dyslexicFont: false,
  reducedMotion: false,
  highlightCurrentLine: false,
};

export function useDynamicUI() {
  const [adaptations, setAdaptations] = useState<UIAdaptations>(DEFAULT_ADAPTATIONS);
  const [riskLevel, setRiskLevel] = useState<'low' | 'moderate' | 'high'>('low');
  const [isAdapting, setIsAdapting] = useState(false);

  const analyzeAndAdapt = useCallback((indicators: Partial<RiskIndicators>) => {
    const {
      eyeTrackingChaos = 0,
      fixationDuration = 200,
      regressionRate = 0,
      voiceFluency = 100,
      pauseFrequency = 0,
    } = indicators;

    // Calculate overall difficulty score
    const difficultyScore = (
      eyeTrackingChaos * 0.3 +
      (fixationDuration > 400 ? 0.3 : fixationDuration > 300 ? 0.15 : 0) +
      regressionRate * 0.2 +
      ((100 - voiceFluency) / 100) * 0.1 +
      (pauseFrequency > 5 ? 0.1 : 0)
    );

    // Determine risk level
    const newRiskLevel = difficultyScore > 0.6 ? 'high' 
      : difficultyScore > 0.3 ? 'moderate' 
      : 'low';
    
    setRiskLevel(newRiskLevel);

    // Calculate adaptations based on difficulty
    const newAdaptations: UIAdaptations = {
      fontSize: difficultyScore > 0.5 ? 1.25 : difficultyScore > 0.3 ? 1.15 : 1,
      letterSpacing: difficultyScore > 0.4 ? 0.05 : 0,
      lineHeight: difficultyScore > 0.5 ? 2 : difficultyScore > 0.3 ? 1.8 : 1.6,
      wordSpacing: difficultyScore > 0.5 ? 0.1 : 0,
      contrast: difficultyScore > 0.6 ? 'high' : 'normal',
      dyslexicFont: difficultyScore > 0.7,
      reducedMotion: difficultyScore > 0.5,
      highlightCurrentLine: difficultyScore > 0.4,
    };

    setIsAdapting(true);
    setAdaptations(newAdaptations);
    
    // Animation complete callback
    setTimeout(() => setIsAdapting(false), 500);

    return newAdaptations;
  }, []);

  const resetAdaptations = useCallback(() => {
    setAdaptations(DEFAULT_ADAPTATIONS);
    setRiskLevel('low');
    setIsAdapting(false);
  }, []);

  const manualAdjust = useCallback((partial: Partial<UIAdaptations>) => {
    setAdaptations(prev => ({ ...prev, ...partial }));
  }, []);

  // Generate CSS custom properties for adaptations
  const cssVars = {
    '--ui-font-size': `${adaptations.fontSize}rem`,
    '--ui-letter-spacing': `${adaptations.letterSpacing}em`,
    '--ui-line-height': adaptations.lineHeight,
    '--ui-word-spacing': `${adaptations.wordSpacing}em`,
  } as React.CSSProperties;

  return {
    adaptations,
    riskLevel,
    isAdapting,
    analyzeAndAdapt,
    resetAdaptations,
    manualAdjust,
    cssVars,
  };
}
