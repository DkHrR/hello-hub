import { useState, useCallback, useEffect } from 'react';

interface AdaptiveUIState {
  isDyslexicFont: boolean;
  isWarmBackground: boolean;
  isSyllableHighlighting: boolean;
  isReadingRuler: boolean;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
}

interface RiskMetrics {
  chaosIndex: number;
  fixationDuration: number;
  regressionRate: number;
  fluencyScore: number;
}

const DEFAULT_STATE: AdaptiveUIState = {
  isDyslexicFont: false,
  isWarmBackground: false,
  isSyllableHighlighting: false,
  isReadingRuler: false,
  fontSize: 18,
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0
};

const DYSLEXIA_STATE: AdaptiveUIState = {
  isDyslexicFont: true,
  isWarmBackground: true,
  isSyllableHighlighting: true,
  isReadingRuler: true,
  fontSize: 22,
  lineHeight: 2.0,
  letterSpacing: 0.05,
  wordSpacing: 0.15
};

export function useAdaptiveUI() {
  const [state, setState] = useState<AdaptiveUIState>(DEFAULT_STATE);
  const [riskLevel, setRiskLevel] = useState<'low' | 'moderate' | 'high'>('low');
  const [isAutoAdapt, setIsAutoAdapt] = useState(true);

  // Monitor metrics and adapt UI when moderate/high risk detected
  const updateFromMetrics = useCallback((metrics: RiskMetrics) => {
    if (!isAutoAdapt) return;

    // Calculate risk from metrics
    const riskScore = (
      (metrics.chaosIndex * 0.3) +
      (Math.min(metrics.fixationDuration / 600, 1) * 0.3) +
      (metrics.regressionRate * 0.2) +
      ((100 - metrics.fluencyScore) / 100 * 0.2)
    );

    let newRiskLevel: 'low' | 'moderate' | 'high' = 'low';
    if (riskScore >= 0.6) {
      newRiskLevel = 'high';
    } else if (riskScore >= 0.35) {
      newRiskLevel = 'moderate';
    }

    setRiskLevel(newRiskLevel);

    // Apply Dynamic UI Morphing for moderate/high risk
    if (newRiskLevel === 'moderate' || newRiskLevel === 'high') {
      setState(prev => ({
        ...prev,
        isDyslexicFont: true,
        isWarmBackground: true,
        isSyllableHighlighting: newRiskLevel === 'high',
        fontSize: newRiskLevel === 'high' ? 24 : 20,
        lineHeight: newRiskLevel === 'high' ? 2.2 : 1.8,
        letterSpacing: 0.05,
        wordSpacing: 0.1
      }));
    }
  }, [isAutoAdapt]);

  // Manual toggles
  const toggleDyslexicFont = useCallback(() => {
    setState(prev => ({ ...prev, isDyslexicFont: !prev.isDyslexicFont }));
  }, []);

  const toggleWarmBackground = useCallback(() => {
    setState(prev => ({ ...prev, isWarmBackground: !prev.isWarmBackground }));
  }, []);

  const toggleSyllableHighlighting = useCallback(() => {
    setState(prev => ({ ...prev, isSyllableHighlighting: !prev.isSyllableHighlighting }));
  }, []);

  const toggleReadingRuler = useCallback(() => {
    setState(prev => ({ ...prev, isReadingRuler: !prev.isReadingRuler }));
  }, []);

  const setFontSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, fontSize: Math.max(12, Math.min(32, size)) }));
  }, []);

  const setLineHeight = useCallback((height: number) => {
    setState(prev => ({ ...prev, lineHeight: Math.max(1.2, Math.min(3, height)) }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    setRiskLevel('low');
  }, []);

  const applyDyslexiaPreset = useCallback(() => {
    setState(DYSLEXIA_STATE);
  }, []);

  // Generate CSS styles based on current state
  const getStyles = useCallback(() => ({
    fontFamily: state.isDyslexicFont ? 'var(--font-dyslexic)' : 'inherit',
    backgroundColor: state.isWarmBackground ? 'hsl(var(--dyslexia-warm))' : 'inherit',
    fontSize: `${state.fontSize}px`,
    lineHeight: state.lineHeight,
    letterSpacing: `${state.letterSpacing}em`,
    wordSpacing: `${state.wordSpacing}em`
  }), [state]);

  return {
    state,
    riskLevel,
    isAutoAdapt,
    setIsAutoAdapt,
    updateFromMetrics,
    toggleDyslexicFont,
    toggleWarmBackground,
    toggleSyllableHighlighting,
    toggleReadingRuler,
    setFontSize,
    setLineHeight,
    reset,
    applyDyslexiaPreset,
    getStyles
  };
}