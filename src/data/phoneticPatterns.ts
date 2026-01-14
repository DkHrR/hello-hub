/**
 * Language-specific phonetic patterns for dyslexia screening
 * Contains hesitation markers, confusable characters, and reading speed norms
 */

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te';

// Speech recognition locales
export const speechLocales: Record<SupportedLanguage, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN'
};

// Hesitation/filler word patterns by language
export const hesitationPatterns: Record<SupportedLanguage, RegExp> = {
  en: /\b(um|uh|er|ah|hmm|like|you know)\b/gi,
  hi: /\b(अम्|हम्म|ये|वो|मतलब|तो|ऐसा)\b/gi,
  ta: /\b(அம்|ஹம்|அதாவது|என்னா|அது)\b/gi,
  te: /\b(అమ్|హమ్|అంటే|ఏమిటి|అది)\b/gi
};

// Common letter/character confusions by script
export const confusablePatterns: Record<SupportedLanguage, Array<{ pattern: RegExp; expected: string; description: string }>> = {
  en: [
    { pattern: /\bdoy\b/i, expected: 'boy', description: 'b/d reversal' },
    { pattern: /\bdag\b/i, expected: 'bag', description: 'b/d reversal' },
    { pattern: /\bded\b/i, expected: 'bed', description: 'b/d reversal' },
    { pattern: /\bdig\b/i, expected: 'big', description: 'b/d reversal' },
    { pattern: /\bbown\b/i, expected: 'down', description: 'b/d reversal' },
    { pattern: /\bsaw\b/i, expected: 'was', description: 'visual reversal' },
    { pattern: /\bno\b/i, expected: 'on', description: 'visual reversal' },
    { pattern: /\bpat\b/i, expected: 'tap', description: 'visual reversal' },
  ],
  hi: [
    // Devanagari confusable pairs
    { pattern: /म(?=\s|$)/g, expected: 'भ', description: 'म/भ confusion' },
    { pattern: /व(?=\s|$)/g, expected: 'ब', description: 'व/ब confusion' },
    { pattern: /श(?=\s|$)/g, expected: 'ष', description: 'श/ष confusion' },
    { pattern: /ध(?=\s|$)/g, expected: 'घ', description: 'ध/घ confusion' },
    { pattern: /न(?=\s|$)/g, expected: 'ण', description: 'न/ण confusion' },
    { pattern: /द(?=\s|$)/g, expected: 'ढ', description: 'द/ढ confusion' },
  ],
  ta: [
    // Tamil confusable pairs
    { pattern: /ண(?=\s|$)/g, expected: 'ன', description: 'ண/ன confusion' },
    { pattern: /ல(?=\s|$)/g, expected: 'ள', description: 'ல/ள confusion' },
    { pattern: /ர(?=\s|$)/g, expected: 'ற', description: 'ர/ற confusion' },
    { pattern: /ந(?=\s|$)/g, expected: 'ன', description: 'ந/ன confusion' },
  ],
  te: [
    // Telugu confusable pairs
    { pattern: /బ(?=\s|$)/g, expected: 'వ', description: 'బ/వ confusion' },
    { pattern: /డ(?=\s|$)/g, expected: 'ఢ', description: 'డ/ఢ confusion' },
    { pattern: /ణ(?=\s|$)/g, expected: 'న', description: 'ణ/న confusion' },
    { pattern: /ల(?=\s|$)/g, expected: 'ళ', description: 'ల/ళ confusion' },
  ]
};

// Reading speed norms (WPM) by language and grade
// These are approximate norms - adjust based on regional standards
export const readingSpeedNorms: Record<SupportedLanguage, Record<string, { min: number; average: number; max: number }>> = {
  en: {
    '1': { min: 30, average: 60, max: 90 },
    '2': { min: 50, average: 90, max: 130 },
    '3': { min: 70, average: 110, max: 150 },
    '4': { min: 90, average: 130, max: 170 },
    '5': { min: 100, average: 140, max: 180 },
    '6': { min: 110, average: 150, max: 190 },
    '7': { min: 120, average: 160, max: 200 },
    '8': { min: 130, average: 170, max: 210 },
    default: { min: 100, average: 150, max: 200 }
  },
  hi: {
    // Hindi reading speeds are typically slower due to script complexity
    '1': { min: 20, average: 40, max: 60 },
    '2': { min: 35, average: 60, max: 90 },
    '3': { min: 50, average: 80, max: 110 },
    '4': { min: 65, average: 95, max: 130 },
    '5': { min: 75, average: 110, max: 145 },
    '6': { min: 85, average: 120, max: 155 },
    '7': { min: 95, average: 130, max: 165 },
    '8': { min: 100, average: 140, max: 180 },
    default: { min: 70, average: 110, max: 150 }
  },
  ta: {
    // Tamil reading speeds
    '1': { min: 18, average: 35, max: 55 },
    '2': { min: 30, average: 55, max: 85 },
    '3': { min: 45, average: 75, max: 105 },
    '4': { min: 60, average: 90, max: 125 },
    '5': { min: 70, average: 105, max: 140 },
    '6': { min: 80, average: 115, max: 150 },
    '7': { min: 90, average: 125, max: 160 },
    '8': { min: 95, average: 135, max: 175 },
    default: { min: 65, average: 100, max: 140 }
  },
  te: {
    // Telugu reading speeds
    '1': { min: 18, average: 35, max: 55 },
    '2': { min: 32, average: 58, max: 88 },
    '3': { min: 48, average: 78, max: 108 },
    '4': { min: 62, average: 92, max: 128 },
    '5': { min: 72, average: 108, max: 142 },
    '6': { min: 82, average: 118, max: 152 },
    '7': { min: 92, average: 128, max: 162 },
    '8': { min: 98, average: 138, max: 178 },
    default: { min: 68, average: 105, max: 145 }
  }
};

// Tesseract language codes
export const tesseractLanguages: Record<SupportedLanguage, string> = {
  en: 'eng',
  hi: 'hin',
  ta: 'tam',
  te: 'tel'
};

// Eye tracking calibration factors per script
// Different scripts have different character densities
export const scriptCalibrationFactors: Record<SupportedLanguage, {
  avgCharacterWidth: number; // in pixels at standard font size
  fixationThreshold: number; // ms - threshold for detecting prolonged fixation
  regressionSensitivity: number; // multiplier for regression detection
}> = {
  en: {
    avgCharacterWidth: 8,
    fixationThreshold: 250,
    regressionSensitivity: 1.0
  },
  hi: {
    avgCharacterWidth: 12, // Devanagari is wider
    fixationThreshold: 300, // Allow more time for complex characters
    regressionSensitivity: 0.9 // Slightly less sensitive
  },
  ta: {
    avgCharacterWidth: 14, // Tamil script is quite wide
    fixationThreshold: 320,
    regressionSensitivity: 0.85
  },
  te: {
    avgCharacterWidth: 13, // Telugu script
    fixationThreshold: 310,
    regressionSensitivity: 0.87
  }
};

// Helper functions

export function getHesitationPattern(language: SupportedLanguage): RegExp {
  return hesitationPatterns[language] || hesitationPatterns.en;
}

export function getSpeechLocale(language: SupportedLanguage): string {
  return speechLocales[language] || 'en-US';
}

export function getTesseractLanguage(language: SupportedLanguage): string {
  return tesseractLanguages[language] || 'eng';
}

export function getReadingSpeedNorm(language: SupportedLanguage, grade: string): { min: number; average: number; max: number } {
  const norms = readingSpeedNorms[language] || readingSpeedNorms.en;
  return norms[grade] || norms.default;
}

export function getConfusablePatterns(language: SupportedLanguage) {
  return confusablePatterns[language] || confusablePatterns.en;
}

export function getScriptCalibration(language: SupportedLanguage) {
  return scriptCalibrationFactors[language] || scriptCalibrationFactors.en;
}

// Calculate phonemic error count with language awareness
export function countPhonemicErrors(transcript: string, language: SupportedLanguage): number {
  const pattern = getHesitationPattern(language);
  const matches = transcript.match(pattern) || [];
  return matches.length;
}

// Calculate fluency score with language-specific adjustments
export function calculateLanguageAwareFluency(
  wpm: number,
  pauseCount: number,
  phonemicErrors: number,
  language: SupportedLanguage,
  grade: string
): number {
  const norm = getReadingSpeedNorm(language, grade);
  
  // WPM score relative to grade norm
  let wpmScore = 50;
  if (wpm >= norm.average) {
    wpmScore = 70 + Math.min(30, ((wpm - norm.average) / (norm.max - norm.average)) * 30);
  } else if (wpm >= norm.min) {
    wpmScore = 40 + ((wpm - norm.min) / (norm.average - norm.min)) * 30;
  } else {
    wpmScore = Math.max(0, (wpm / norm.min) * 40);
  }
  
  // Pause penalty (language-adjusted)
  const pausePenalty = Math.min(pauseCount * 3, 25);
  
  // Error penalty
  const errorPenalty = Math.min(phonemicErrors * 5, 20);
  
  return Math.max(0, Math.round(wpmScore - pausePenalty - errorPenalty));
}

// Detect character reversals/confusions with language awareness
export function detectCharacterConfusions(
  text: string,
  language: SupportedLanguage
): Array<{ char: string; position: number; context: string; description: string }> {
  const patterns = getConfusablePatterns(language);
  const confusions: Array<{ char: string; position: number; context: string; description: string }> = [];
  
  patterns.forEach(({ pattern, expected, description }) => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      confusions.push({
        char: match[0],
        position: match.index,
        context: `"${match[0]}" (expected: "${expected}")`,
        description
      });
    }
  });
  
  return confusions;
}
